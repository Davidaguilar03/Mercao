"""Discover and download the official DANE SIPSA files (wholesale prices and supply) into data/raw.

Links are discovered by parsing the DANE pages, not guessed. Files already on disk are skipped and failures are
logged and skipped, so the step can be re-run safely.
"""

import logging
import re
import time
from collections.abc import Callable
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from backend.app.domains.ingestion.manifest import ManifestEntry, load_manifest, write_manifest

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

Link = tuple[str, str, str]

log = logging.getLogger(__name__)


def fetch(session: requests.Session, url: str, retries: int = 4, delay: float = 1.0,
          stream: bool = False) -> requests.Response | None:
    """GET with retries and backoff; None on 404 or after the last failed attempt."""
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


def get_links(session: requests.Session, page_url: str, delay: float) -> list[Link]:
    """(absolute url, anchor text, first text of the enclosing row) for every link of a page."""
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


def discover_weekly_prices(session: requests.Session, delay: float) -> list[tuple[str, str]]:
    """Weekly bulletin annexes: index page, one page per year, then the 'anex' spreadsheets."""
    index_links = get_links(session, WEEKLY_INDEX_URL, delay)
    year_pages = sorted({
        url for url, _, _ in index_links
        if "/mayoristas-boletin-semanal-1/" in url and re.search(r"20(1[2-9]|2[0-9])", url)
    })
    found: dict[str, str] = {}
    for page in [WEEKLY_INDEX_URL, *year_pages]:
        links = index_links if page == WEEKLY_INDEX_URL else get_links(session, page, delay)
        for url, text, context in links:
            name = unquote(urlparse(url).path.rsplit("/", 1)[-1])
            if SPREADSHEET_RE.search(name) and ("anex" in name.lower() or text.lower().startswith("anexo")):
                found[url] = context
        log.info("Weekly page %s -> %d files so far", page.rsplit("/", 1)[-1], len(found))
    return sorted(found.items())


def discover_monthly_prices(session: requests.Session, delay: float) -> list[tuple[str, str]]:
    """Monthly historical price series (reference only, not used by the pipeline)."""
    links = get_links(session, MONTHLY_INDEX_URL, delay) + get_links(session, PRICES_MAIN_URL, delay)
    found: dict[str, str] = {}
    for url, text, _ in links:
        name = urlparse(url).path.lower()
        if SPREADSHEET_RE.search(name) and "arroz" not in name and (
            "seriehistoricamayorista" in name or "series-historicas-precios-mayoristas" in name
        ):
            found[url] = text
    return sorted(found.items())


def discover_supply(session: requests.Session, delay: float) -> list[tuple[str, str]]:
    """Supply historical series and yearly microdata."""
    found: dict[str, str] = {}
    for url, text, _ in get_links(session, SUPPLY_INDEX_URL, delay):
        name = urlparse(url).path.lower()
        if SPREADSHEET_RE.search(name) and ("series-historicas-abastecimiento" in name or "microdato" in name):
            found[url] = text
    return sorted(found.items())


DISCOVERERS: dict[str, Callable[[requests.Session, float], list[tuple[str, str]]]] = {
    "prices_weekly": discover_weekly_prices,
    "prices_monthly": discover_monthly_prices,
    "supply": discover_supply,
}


def download_file(session: requests.Session, url: str, target_dir: Path, delay: float) -> tuple[str, Path]:
    """Download one file atomically; returns (status, target path)."""
    target = target_dir / unquote(urlparse(url).path.rsplit("/", 1)[-1])
    if target.exists() and target.stat().st_size > 0:
        return "skipped", target
    response = fetch(session, url, delay=delay, stream=True)
    if response is None:
        return "failed", target
    if "text/html" in response.headers.get("Content-Type", ""):
        log.warning("Got HTML instead of a file for %s", url)
        return "failed", target
    tmp = target.with_suffix(target.suffix + ".part")
    with open(tmp, "wb") as handle:
        for chunk in response.iter_content(chunk_size=65536):
            handle.write(chunk)
    tmp.replace(target)
    time.sleep(delay)
    return "downloaded", target


def download_all(raw_dir: Path, sources: list[str], delay: float = 1.0) -> dict[tuple[str, str], int]:
    """Download every discovered file of the given sources and update the manifest. Returns counts by status."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, ManifestEntry] = {}
    if (raw_dir / "manifest.csv").exists():
        manifest = {entry.url: entry for entry in load_manifest(raw_dir)}
    session = requests.Session()
    counts: dict[tuple[str, str], int] = {}
    failures: list[str] = []
    for source in sources:
        urls = DISCOVERERS[source](session, delay)
        log.info("%s: %d files discovered", source, len(urls))
        target_dir = raw_dir / source
        target_dir.mkdir(exist_ok=True)
        for i, (url, label) in enumerate(urls, 1):
            status, target = download_file(session, url, target_dir, delay)
            log.info("[%s %d/%d] %s %s", source, i, len(urls), status, target.name)
            manifest[url] = ManifestEntry(source=source, url=url, file=f"{raw_dir.parent.name}/{raw_dir.name}/"
                                          f"{source}/{target.name}", label=label, status=status)
            counts[(source, status)] = counts.get((source, status), 0) + 1
            if status == "failed":
                failures.append(url)
    write_manifest(raw_dir, list(manifest.values()))
    (raw_dir / "download_failures.log").write_text("\n".join(failures) + ("\n" if failures else ""), encoding="utf-8")
    return counts
