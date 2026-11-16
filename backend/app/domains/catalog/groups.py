"""Food groups and product families shared by both sources."""

from backend.app.domains.ingestion.text import name_key

FOOD_GROUPS = ("hortalizas", "frutas", "tuberculos", "granos", "lacteos_huevos", "carnes", "pescados", "procesados",
               "otros")
_GROUP_HINTS = (
    ("verdura", "hortalizas"), ("hortaliza", "hortalizas"), ("fruta", "frutas"), ("tuberculo", "tuberculos"),
    ("grano", "granos"), ("cereal", "granos"), ("huevo", "lacteos_huevos"), ("lacteo", "lacteos_huevos"),
    ("carne", "carnes"), ("pescado", "pescados"), ("procesado", "procesados"),
)
# Families made of several words; any other product uses its first word ('papa parda pastusa' -> 'papa').
COMPOUND_FAMILIES = ("tomate de arbol", "carne de res", "carne de cerdo", "carne de pollo")


def food_group(label: str) -> str:
    """Map a published group title ('Tubérculos, raíces y plátanos', 'FRUTAS', 'Huevos y lácteos**') to FOOD_GROUPS."""
    key = name_key(label)
    for hint, group in _GROUP_HINTS:
        if hint in key:
            return group
    return "otros"


def family_and_variety(canonical_name: str) -> tuple[str, str]:
    """('Papa parda pastusa') -> ('papa', 'parda pastusa'); the variety keeps the published spelling."""
    key = name_key(canonical_name)
    family = next((f for f in COMPOUND_FAMILIES if key == f or key.startswith(f + " ")), key.split(" ")[0])
    words = canonical_name.split()
    variety = " ".join(words[len(family.split(" ")):]).strip(" ,")
    return family, variety
