"""Focus set of the project: the only products and markets that get an id in the curated catalog.

Names are the exact SIPSA spellings with the best weekly coverage since 2016 (see docs/data_pipeline.md). Every other
product or market stays in the raw-level tables with an empty id and is reported as out of scope.
"""

FOCUS_PRODUCTS = (
    "Papa parda pastusa",
    "Cebolla cabezona blanca",
    "Cebolla junca",
    "Cebolla junca Aquitania",  # the variety published in Bogotá, Cali, Chiquinquirá, Ibagué and Tunja
    "Tomate chonto",
    "Zanahoria",
    "Habichuela",
    "Arveja verde en vaina",
    "Plátano hartón verde",
    "Cilantro",
    "Mora de Castilla",
    "Lulo",
    "Pimentón",
)

FOCUS_MARKETS = (
    "Bogotá, D.C., Corabastos",
    "Medellín, Central Mayorista de Antioquia",
    "Cali, Cavasa",
    "Barranquilla, Barranquillita",
    "Bucaramanga, Centroabastos",
    "Pereira, Mercasa",
    "Armenia, Mercar",
    "Cartago (Valle del Cauca)",
    "Chiquinquirá (Boyacá)",
    "Tunja, Complejo de Servicios del Sur",
    "Ibagué, Plaza La 21",
)
