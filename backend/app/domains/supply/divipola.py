"""Official DIVIPOLA department codes (DANE). Department names in the supply files are resolved from these codes."""

DEPARTMENTS = {
    "05": "ANTIOQUIA",
    "08": "ATLÁNTICO",
    "11": "BOGOTÁ, D.C.",
    "13": "BOLÍVAR",
    "15": "BOYACÁ",
    "17": "CALDAS",
    "18": "CAQUETÁ",
    "19": "CAUCA",
    "20": "CESAR",
    "23": "CÓRDOBA",
    "25": "CUNDINAMARCA",
    "27": "CHOCÓ",
    "41": "HUILA",
    "44": "LA GUAJIRA",
    "47": "MAGDALENA",
    "50": "META",
    "52": "NARIÑO",
    "54": "NORTE DE SANTANDER",
    "63": "QUINDÍO",
    "66": "RISARALDA",
    "68": "SANTANDER",
    "70": "SUCRE",
    "73": "TOLIMA",
    "76": "VALLE DEL CAUCA",
    "81": "ARAUCA",
    "85": "CASANARE",
    "86": "PUTUMAYO",
    "88": "ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA",
    "91": "AMAZONAS",
    "94": "GUAINÍA",
    "95": "GUAVIARE",
    "97": "VAUPÉS",
    "99": "VICHADA",
}
COLOMBIA = "COLOMBIA"
COLOMBIA_ISO_NUMERIC = "170"
_UNKNOWN_NAMES = {"", "n.a.", "na", "otro", "otros"}


def is_municipality_code(code: str) -> bool:
    """Colombian municipality codes have five digits and start with a valid department code."""
    return len(code) == 5 and code.isdigit() and code[:2] in DEPARTMENTS


def resolve_origin(dept_code: str, muni_code: str, muni_name: str) -> tuple[str | None, str | None, str | None]:
    """(department code, municipality code, country) of one published origin.

    - Colombian origin: the department code is taken from the municipality code (its first two digits), which also
      fixes rows whose department name does not match their code.
    - Imported food (municipality code 'n.a.' or a 3-digit ISO 3166-1 code, the name is the country): no department
      or municipality, the country is the published name.
    """
    if is_municipality_code(muni_code):
        return muni_code[:2], muni_code, COLOMBIA
    code = dept_code.zfill(2) if dept_code.isdigit() else ""
    if code in DEPARTMENTS:
        return code, None, COLOMBIA
    if muni_code == COLOMBIA_ISO_NUMERIC:
        return None, None, COLOMBIA
    country = muni_name.strip().upper()
    return None, None, None if country.lower() in _UNKNOWN_NAMES else country
