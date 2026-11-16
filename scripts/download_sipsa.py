"""Discover and download official DANE SIPSA files (wholesale prices and supply) into data/raw.

Links are discovered by parsing the DANE pages, not guessed. Files already on disk are skipped.
Failures are logged to data/raw/download_failures.log and the run continues.

Usage: python scripts/download_sipsa.py [--only prices_weekly,prices_monthly,supply] [--delay 1.0]
"""

import argparse
import csv
import logging
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.dane.gov.co"
SIPSA_PATH = "/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa"
WEEKLY_INDEX_URL = f"{BASE_URL}{SIPSA_PATH}/mayoristas-boletin-semanal-1"
MONTHLY_INDEX_URL = f"{BASE_URL}{SIPSA_PATH}/mayoristas-boletin-mensual-1"
PRICES_MAIN_URL = f"{BASE_URL}{SIPSA_PATH}/componente-precios-mayoristas"
SUPPLY_INDEX_URL = f"{BASE_URL}{SIPSA_PATH}/componente-abastecimientos-1"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
}
SPREADSHEET_RE = re.compile(r"\.(xlsx|xls|zip)$", re.IGNORECASE)

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "data" / "raw"

log = logging.getLogger("download_sipsa")


def fetch(session, url, retries=4, delay=1.0, stream=False):
    for attempt in range(1, retries + 1):
        wait = delay * attempt * 2
        try:
            response = session.get(url, headers=HEADERS, timeout=90, stream=stream)
            if response.status_code == 200:
                return response
            log.warning("HTTP %s for %s (attempt %d)", response.status_code, url, attempt)
            if response.status_code == 404:
                return None
            if response.status_code in (429, 503):
                retry_after = response.headers.get("Retry-After", "")
                wait = float(retry_after) if retry_after.isdigit() else 30 * attempt
        except requests.RequestException as exc:
            log.warning("Error %s for %s (attempt %d)", exc, url, attempt)
        time.sleep(wait)
    return None


def get_links(session, page_url, delay):
    response = fetch(session, page_url, delay=delay)
    time.sleep(delay)
    if response is None:
        log.error("Could not open page %s", page_url)
        return []
    response.encoding = "utf-8"
    soup = BeautifulSoup(response.text, "html.parser")
    links = []
    for anchor in soup.find_all("a", href=True):
        parent = anchor.find_parent(["tr", "li", "p"])
        context = parent.get_text(" | ", strip=True).split(" | ")[0] if parent else ""
        links.append((urljoin(BASE_URL, anchor["href"].strip()), anchor.get_text(" ", strip=True), context))
    return links


def discover_weekly_prices(session, delay):
    """Weekly bulletin annexes: index page -> one page per year -> 'anex' spreadsheets."""
    index_links = get_links(session, WEEKLY_INDEX_URL, delay)
    year_pages = sorted({
        url for url, text, _ in index_links
        if "/mayoristas-boletin-semanal-1/" in url and re.search(r"20(1[2-9]|2[0-6])", url)
    })
    found = {}
    pages = [WEEKLY_INDEX_URL] + year_pages
    for page in pages:
        links = index_links if page == WEEKLY_INDEX_URL else get_links(session, page, delay)
        for url, text, context in links:
            name = unquote(urlparse(url).path.rsplit("/", 1)[-1])
            if SPREADSHEET_RE.search(name) and ("anex" in name.lower() or text.lower().startswith("anexo")):
                found[url] = context
        log.info("Weekly page %s -> %d files so far", page.rsplit("/", 1)[-1], len(found))
    return sorted(found.items())


def discover_monthly_prices(session, delay):
    """Monthly historical price series (one file per year or range)."""
    links = get_links(session, MONTHLY_INDEX_URL, delay) + get_links(session, PRICES_MAIN_URL, delay)
    found = {}
    for url, text, context in links:
        name = urlparse(url).path.lower()
        if not SPREADSHEET_RE.search(name):
            continue
        if "arroz" in name:
            continue
        if "seriehistoricamayorista" in name or "series-historicas-precios-mayoristas" in name:
            found[url] = text
    return sorted(found.items())


def discover_supply(session, delay):
    """Supply historical series and yearly microdata."""
    links = get_links(session, SUPPLY_INDEX_URL, delay)
    found = {}
    for url, text, context in links:
        name = urlparse(url).path.lower()
        if SPREADSHEET_RE.search(name) and ("series-historicas-abastecimiento" in name or "microdato" in name):
            found[url] = text
    return sorted(found.items())


def download(session, url, target_dir, delay):
    filename = unquote(urlparse(url).path.rsplit("/", 1)[-1])
    target = target_dir / filename
    if target.exists() and target.stat().st_size > 0:
        return "skipped", target
    response = fetch(session, url, delay=delay, stream=True)
    if response is None:
        return "failed", target
    content_type = response.headers.get("Content-Type", "")
    if "text/html" in content_type:
        log.warning("Got HTML instead of a file for %s", url)
        return "failed", target
    tmp = target.with_suffix(target.suffix + ".part")
    with open(tmp, "wb") as handle:
        for chunk in response.iter_content(chunk_size=65536):
            handle.write(chunk)
    tmp.replace(target)
    time.sleep(delay)
    return "downloaded", target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="prices_weekly,prices_monthly,supply")
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(RAW_DIR / "download.log", encoding="utf-8")],
    )
    discoverers = {
        "prices_weekly": discover_weekly_prices,
        "prices_monthly": discover_monthly_prices,
        "supply": discover_supply,
    }
    session = requests.Session()
    manifest_path = RAW_DIR / "manifest.csv"
    manifest = {}
    if manifest_path.exists():
        with open(manifest_path, newline="", encoding="utf-8") as handle:
            manifest = {row["url"]: row for row in csv.DictReader(handle)}
    manifest_rows = []
    failures = []
    for source in [s.strip() for s in args.only.split(",") if s.strip()]:
        urls = discoverers[source](session, args.delay)
        log.info("%s: %d files discovered", source, len(urls))
        target_dir = RAW_DIR / source
        target_dir.mkdir(exist_ok=True)
        for i, (url, label) in enumerate(urls, 1):
            status, target = download(session, url, target_dir, args.delay)
            log.info("[%s %d/%d] %s %s", source, i, len(urls), status, target.name)
            row = {"source": source, "url": url, "file": target.relative_to(ROOT_DIR).as_posix(), "label": label, "status": status}
            manifest_rows.append(row)
            manifest[url] = row
            if status == "failed":
                failures.append(url)

    with open(manifest_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source", "url", "file", "label", "status"], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(manifest.values())
    with open(RAW_DIR / "download_failures.log", "w", encoding="utf-8") as handle:
        handle.write("\n".join(failures) + ("\n" if failures else ""))

    counts = {}
    for row in manifest_rows:
        counts[(row["source"], row["status"])] = counts.get((row["source"], row["status"]), 0) + 1
    print("\nSummary:")
    for (source, status), count in sorted(counts.items()):
        print(f"  {source:15s} {status:11s} {count}")
    if failures:
        print("Failed URLs:")
        for url in failures:
            print("  ", url)


if __name__ == "__main__":
    main()
