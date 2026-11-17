# Pipeline de datos SIPSA (DANE)

Este documento describe cómo se construye `data/processed/mercao.db` a partir de los archivos oficiales del DANE.
Las cifras corresponden a la construcción del 2026-11-15 (archivos descargados hasta la semana del 7 al 13 de
noviembre de 2026). Se pueden comprobar en `data/processed/build_summary.json` y en la tabla `pipeline_log`, que
genera cada construcción.

Comando:

```bash
python -m backend.scripts.build_database
```

## 1. Fuentes

Todas las fuentes son del Sistema de Información de Precios y Abastecimiento del Sector Agropecuario (SIPSA) del DANE:

| Fuente | Página | Archivos | Uso |
|---|---|---|---|
| Anexos de los boletines semanales de precios mayoristas (2012 a 2026) | https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/mayoristas-boletin-semanal-1 | 729 | Tabla `prices` |
| Microdatos anuales de abastecimiento (2013 a 2026) | https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-abastecimientos-1 | 14 | Tablas `supply` y `supply_weekly` |
| Series históricas mensuales de precios y serie agregada de abastecimiento | mismas páginas | 11 | Solo de referencia, no se cargan |

`python -m backend.scripts.download_raw` descubre los enlaces leyendo esas páginas y descarga cada archivo en
`data/raw/<fuente>/`. El archivo `data/raw/manifest.csv` guarda la URL de cada archivo y el texto que acompaña al
enlace. De ese texto sale la fecha de cada semana, porque los nombres de archivo no siguen un patrón.

## 2. Pasos del pipeline

1. **Selección de fuentes** (`pipeline.select_sources`): anexos semanales y microdatos anuales del manifiesto.
2. **Lectura con caché** (`domains/ingestion`): cada archivo se lee una sola vez y el resultado queda en
   `data/interim/pipeline/`. La caché se invalida si cambia el tamaño, la fecha de modificación o la versión del
   lector. Los anexos semanales se leen en paralelo con 6 procesos. Los microdatos se leen fila por fila con 2
   procesos y codifican los textos sobre la marcha, para no pasar de unos cientos de MB de memoria por archivo.
3. **Catálogo** (`domains/catalog`): los nombres publicados se traducen a `product_id` y `market_id` con los CSV de
   `backend/app/domains/catalog/data/`. Solo los productos y mercados del conjunto foco tienen id (sección 5).
4. **Precios** (`domains/prices/builder.py`): asignación de semana ISO y reglas de limpieza (sección 3).
5. **Cobertura** (`domains/prices/coverage.py`): cobertura de cada par producto-mercado del conjunto foco y regla
   `usable_for_model` (sección 6).
6. **Abastecimiento** (`domains/supply/builder.py`): corrección de orígenes con DIVIPOLA y agregado por semana ISO
   de los productos y mercados foco, archivo por archivo (sección 4).
7. **Escritura**: todo se escribe en un archivo temporal que reemplaza a `mercao.db` solo si la construcción termina
   bien. El log queda en `data/processed/pipeline.log`.

Tiempo de una reconstrucción completa con la caché llena: **225 s** (3,7 min), de los cuales unos 2,5 min son las
reglas de limpieza de precios sobre 3,3 millones de filas y 41 s el agregado de abastecimiento. La primera lectura de
los archivos crudos, sin caché, añade unos 7 min (los 14 microdatos suman 1,2 GB). Tamaño de `mercao.db`: **406 MB**.

## 3. Reglas de limpieza de precios

### 3.1 Lectura de los anexos

- Hay dos estructuras de anexo. En la **plana** (desde 2018) hay una hoja por grupo y columnas
  Producto | Mercado | mín. | máx. | medio. En la **anidada** (archivos anteriores) hay varios «Cuadros» en una hoja,
  con una fila de producto seguida de una fila por mercado. El lector busca la fila de encabezado por su contenido,
  no por su posición.
- **27 anexos** son archivos .xlsx publicados con extensión .xls. El formato se detecta por el contenido del archivo.
- Las filas de notas al pie («* Los precios…», «Fuente: …») no son datos y se omiten.

### 3.2 Fecha y semana ISO

- La fecha sale de la etiqueta publicada por el DANE (por ejemplo «20 al 26 de diciembre de 2014»). Si la etiqueta
  no trae el año, se toma del nombre del archivo.
- Duración de las etiquetas: 7 días en 686 archivos. Las 42 restantes coinciden con festivos (Semana Santa, fin de
  año): 4 días (1), 5 días (15), 6 días (13), 8 días (10) y 9 días (3).
- **Normalización a semana ISO**: cada boletín se asigna a la semana ISO (lunes a domingo) que contiene más días de
  su intervalo. Si hay empate, gana la semana de la fecha de cierre. En un boletín normal de sábado a viernes, 6 de
  los 7 días caen en la semana ISO del viernes. Los 728 boletines con fecha quedan en 728 semanas ISO distintas,
  sin choques. En la tabla `prices`, `week_start` y `week_end` son el lunes y el domingo de esa semana ISO. Las
  fechas originales de la etiqueta quedan en `price_files`.
- **Excluido**: `Anexo_Bol_Semanal_100may10_2014.xls`, cuya etiqueta es «Boletín número 100», sin fecha. Queda
  registrado en `price_files` (`status = excluded_undated`), en `pipeline_log` y en el log.

### 3.3 Reglas y conteos

Ninguna fila se elimina sin dejar rastro: cada fila excluida queda en `price_exclusions` con su regla (`reason`) y un
detalle.

| Paso | Filas |
|---|---|
| Filas leídas de los 728 anexos con fecha | 3.273.817 |
| `header_artifact`: encabezado repetido leído como dato («Producto» \| «Fuente») | 1 |
| `missing_price`: precio medio vacío o ≤ 0 | 1 |
| `duplicate_exact`: mismo producto, mercado y semana repetidos con los mismos precios | 206 |
| `duplicate_conflict`: mismo producto, mercado y semana con precios distintos; se conserva la fila del boletín más reciente | 74 |
| `unit_jump`: salto de unidad (regla 3.4) | 442 |
| **Filas en `prices`** | **3.273.093** |

Además, 1.281 filas tienen el precio mínimo mayor que el máximo, o el medio fuera de ese rango. **No se excluyen**:
quedan marcadas con `range_inconsistent = 1`. Solo 22 de ellas son del conjunto foco.

Las reglas de duplicados y de saltos de unidad se aplican a **todas** las series, también a las que están fuera del
conjunto foco. Para esas series se agrupa por el nombre publicado normalizado (sin tildes, mayúsculas ni signos).

### 3.4 Regla de saltos de unidad

Está definida en `backend/app/domains/prices/cleaning.py` (`UNIT_JUMP_THRESHOLD = 20`). Para cada serie
producto-mercado, en orden de semana:

1. El precio de referencia inicial es el primer precio que está a menos de 20 veces de la mediana de la serie. Así
   se detecta también una serie que empieza en la unidad equivocada.
2. Un precio medio más de 20 veces mayor, o 20 veces menor, que el precio de referencia se marca como salto y se
   excluye. No se convierte en referencia, de modo que un bloque de semanas publicado en otra unidad se excluye
   completo, y la serie se retoma cuando vuelve la unidad correcta.
3. Cada precio aceptado pasa a ser la nueva referencia.

Un cambio de ×20 de una semana a la siguiente no es un movimiento de mercado. Es un precio por tonelada o por bulto
en lugar de por kilogramo, o un error de digitación.

Resultado: 442 filas excluidas en 119 series, todas fuera del conjunto foco:

| Producto | Filas excluidas |
|---|---|
| Harina de arroz | 99 |
| Arroz paddy verde | 80 |
| Arroz blanco en bulto | 70 |
| Arroz blanco empacado | 68 |
| Arroz granza | 64 |
| Arroz cristal | 54 |
| Pastas alimenticias | 6 |
| Huevo rojo A | 1 |

### 3.5 Unidades

Según las notas al pie de los anexos, todo está en pesos por kilogramo (`unit = kg`) salvo los huevos y el bocadillo
(`unidad`) y los aceites, el jugo de frutas y el vinagre (`litro`). Los 13 productos foco están en `kg`.

## 4. Reglas de abastecimiento

| Archivo | Filas leídas | Filas válidas (en caché) | Notas | Mercados | Toneladas |
|---|---|---|---|---|---|
| microdato-abastecimiento-2013.xlsx | 1.046.815 | 1.046.815 | | 14 | 4.457.161 |
| microdato-abastecimiento-2014.xlsx | 1.099.581 | 1.099.581 | | 14 | 4.514.684 |
| microdato-abastecimiento-2015.xlsx | 1.177.640 | 1.177.640 | | 16 | 4.596.402 |
| microdato-abastecimiento-2016.xlsx | 1.230.868 | 1.230.868 | | 17 | 4.802.848 |
| microdato-abastecimiento-2017.xlsx | 1.365.884 | 1.365.884 | | 20 | 5.300.901 |
| microdato-abastecimiento-2018.xlsx | 1.727.577 | 1.727.577 | | 29 | 6.227.545 |
| microdato-abastecimiento-2019.xlsx | 1.805.560 | 1.805.560 | | 29 | 6.228.161 |
| microdato-abastecimiento-2020.xlsx | 1.813.661 | 1.813.661 | todas las fechas en texto `dd/mm/aa` | 29 | 6.308.398 |
| microdato-abastecimiento-2021.xlsx | 1.844.286 | 1.844.286 | | 29 | 6.310.561 |
| microdato-abastecimiento-2022.xlsx | 1.857.838 | 1.857.837 | 1 fila con cantidad ≤ 0 | 29 | 6.264.140 |
| microdato-abastecimiento-2023.xlsx | 2.013.625 | 2.013.625 | | 32 | 6.695.584 |
| anex-Microdato-abastecimiento-2024.xlsx | 2.166.159 | 2.166.153 | 6 filas sin fecha (notas al pie) | 32 | 7.174.039 |
| anex-Microdato-abastecimiento-2025.xlsx | 2.266.018 | 2.266.012 | 6 filas sin fecha (notas al pie) | 32 | 7.534.613 |
| anex-Microdato-abastecimiento-2026.xlsx | 1.974.816 | 1.974.810 | 6 filas sin fecha (notas al pie) | 32 | 6.449.568 |
| **Total** | **23.390.328** | **23.390.309** | | | |

- **Fechas de 2020**: las 1.813.661 fechas en texto (`02/01/20`) se convierten con día primero.
- **Departamento desde DIVIPOLA**: el código de departamento sale de los dos primeros dígitos del código DIVIPOLA del
  municipio, y el nombre, de la lista oficial del DANE (`domains/supply/divipola.py`). Esto unifica variantes como
  «BOGOTÁ, D. C.» y «BOGOTÁ, D.C.». También corrige el código 52 publicado con el nombre CUNDINAMARCA: el municipio
  52356 es de Nariño, así que queda NARIÑO. En total se corrigieron 11 filas cuyo nombre de departamento no
  correspondía al código.
- **Nombre del municipio**: es el nombre publicado más frecuente para cada código DIVIPOLA, considerando los 14 años.
- **País de origen**: `COLOMBIA` para los orígenes con código DIVIPOLA. Para los alimentos importados, el municipio
  viene como «n.a.» o como un código ISO 3166-1 de 3 dígitos y el nombre es el país (CHILE, ECUADOR, CANADÁ…). En
  esos 292.735 casos, `origin_country` es ese país y el departamento y el municipio quedan vacíos. El brief pedía el
  país solo desde 2024, pero desde 2013 los archivos ya marcan los importados con «OTRO / n.a.» y el nombre del
  país, así que se completa en todos los años.
- **Entrada de mercados en 2018**: el número de mercados pasa de 20 en 2017 a 29 en 2018. Los 9 que entran son
  Ibagué Plaza La 21, Manizales Centro Galerías, Montería Mercado del Sur, Pasto El Potrerillo, Popayán Plaza de
  mercado del barrio Bolívar, Santa Marta, Sincelejo Nuevo Mercado, Valledupar Mercabastos y Valledupar Mercado
  Nuevo. Por eso el tonelaje total salta de 5,3 a 6,2 millones de toneladas, sin que haya un cambio real en el
  abastecimiento. También entran mercados en 2015 (2), 2016 (1), 2017 (3), 2023 (3) y 2025 (1). Los volúmenes entre
  años solo se pueden comparar con el mismo conjunto de mercados.
- **Qué se guarda**: la base solo guarda el abastecimiento de los productos foco en los mercados foco que existen en
  el componente de abastecimiento: 3.323.960 de las 23.390.309 filas diarias. Esas filas se suman por semana ISO de
  la fecha de ingreso, mercado, producto y origen (código de departamento, código de municipio y país) en la tabla
  `supply` (502.150 filas). Los nombres de departamentos y municipios están en las tablas de consulta
  `origin_departments` (33, nombres oficiales DIVIPOLA) y `origin_municipalities` (1.095 códigos con su nombre y
  departamento), no repetidos en cada fila. Las filas fuera del foco no se guardan en la base, pero el detalle diario
  completo de los 14 archivos queda en la caché parquet (`data/interim/pipeline/supply/`). Para ampliar el foco basta
  con regenerar el catálogo y reconstruir la base, sin volver a leer los archivos crudos.
- **`supply_weekly`**: total de kilogramos por semana ISO, mercado y producto (todos los orígenes), solo para el
  conjunto foco. Se une con `prices` por (`iso_year`, `iso_week`, `market_id`, `product_id`). La semana de precios
  sale de boletines de sábado a viernes y la de abastecimiento es lunes a domingo, así que hay hasta un día de
  diferencia entre ambas.

## 5. Conjunto foco y catálogo

El catálogo curado (`backend/app/domains/catalog/data/`) y el mapeo de nombres cubren solo el conjunto foco,
definido en `backend/app/domains/catalog/focus.py`. Cada producto foco se identifica por su nombre exacto en SIPSA,
elegido por cobertura semanal desde 2016 en los mercados foco.

### 5.1 Productos (13)

| product_id | Nombre SIPSA | Familia | Grupo |
|---|---|---|---|
| 1 | Papa parda pastusa | papa | tuberculos |
| 2 | Cebolla cabezona blanca | cebolla | hortalizas |
| 3 | Cebolla junca | cebolla | hortalizas |
| 4 | Cebolla junca Aquitania | cebolla | hortalizas |
| 5 | Tomate chonto | tomate | hortalizas |
| 6 | Zanahoria | zanahoria | hortalizas |
| 7 | Habichuela | habichuela | hortalizas |
| 8 | Arveja verde en vaina | arveja | hortalizas |
| 9 | Plátano hartón verde | platano | tuberculos |
| 10 | Cilantro | cilantro | hortalizas |
| 11 | Mora de Castilla | mora | frutas |
| 12 | Lulo | lulo | frutas |
| 13 | Pimentón | pimenton | hortalizas |

Se agregó «Cebolla junca Aquitania» a los 12 productos pedidos. En Bogotá, Cali, Chiquinquirá, Ibagué y Tunja la
cebolla junca se publica con ese nombre, no como «Cebolla junca». Las dos no se comparan entre sí: tienen grupos
comparables distintos.

### 5.2 Mercados (11)

| market_id | Mercado | Ciudad | Departamento |
|---|---|---|---|
| 1 | Bogotá, D.C., Corabastos | Bogotá | Bogotá, D.C. |
| 2 | Medellín, Central Mayorista de Antioquia | Medellín | Antioquia |
| 3 | Cali, Cavasa | Cali | Valle del Cauca |
| 4 | Barranquilla, Barranquillita | Barranquilla | Atlántico |
| 5 | Bucaramanga, Centroabastos | Bucaramanga | Santander |
| 6 | Pereira, Mercasa | Pereira | Risaralda |
| 7 | Armenia, Mercar | Armenia | Quindío |
| 8 | Cartago (Valle del Cauca) | Cartago | Valle del Cauca |
| 9 | Chiquinquirá (Boyacá) | Chiquinquirá | Boyacá |
| 10 | Tunja, Complejo de Servicios del Sur | Tunja | Boyacá |
| 11 | Ibagué, Plaza La 21 | Ibagué | Tolima |

En las ciudades con varios mercados se eligió el de mejor cobertura de los productos foco: Medellín Central
Mayorista (75 %) sobre la Plaza Minorista (66 %), Cali Cavasa (64 %) sobre Santa Elena (56 %) y Barranquilla
Barranquillita (78 %) sobre Granabastos (61 %). Tunja e Ibagué tienen datos útiles y se incluyeron. Las coordenadas
son las del centro de la ciudad (aproximadas, para el mapa).

### 5.3 Mapeo de nombres

- **Regla**: un nombre publicado, en precios o en abastecimiento, se asigna a un producto foco si coincide con él
  después de normalizarlo (sin tildes, mayúsculas, signos ni espacios dobles). 31 nombres quedan mapeados: 13
  exactos y 18 variantes de escritura, por ejemplo «Papa Parda Pastusa» o «Plátano Hartón Verde». Los mercados
  siguen la misma regla (21 nombres) más una lista corta de alias revisados a mano (`MARKET_ALIASES`), por ejemplo
  «Cali, Santa Helena» = «Cali, Santa Elena», que se publican en fechas que no se cruzan.
- **Código CPC**: desde 2024 los microdatos de abastecimiento publican el código CPC. **No se usa para mapear**, por
  dos razones. Identifica la especie y no la variedad: todas las papas comparten 0151001, y «Tomate larga vida»
  tiene el mismo código que «Tomate chonto». Y los anexos de precios no tienen CPC. Se guarda en
  `product_mapping.cpc_code` como referencia. Esta decisión cambia lo que pedía el brief («usar el CPC donde esté
  disponible»).
- **Abastecimiento de productos y mercados foco**: «Mora de Castilla» y «Cebolla junca Aquitania» no existen en
  abastecimiento. Ahí solo se publican la categoría agregada «Mora» y la «Cebolla junca» genérica, que no se mapean
  para no mezclar variedades. Cartago y Chiquinquirá no son mercados del componente de abastecimiento. Así,
  `supply_weekly` tiene 11 productos en 9 mercados.

## 6. Cobertura y pares utilizables

La tabla `coverage` tiene una fila por par producto-mercado del conjunto foco con al menos un precio: 130 de los 143
pares posibles. Columnas: primera y última semana, número de semanas con dato, semanas con dato desde 2016-W01,
proporción de semanas faltantes desde 2016 (sobre las 567 semanas ISO entre 2016-W01 y la última semana del
conjunto) y `has_recent_data` (dato en las últimas 8 semanas).

**Regla** (`coverage.py`): `usable_for_model = 1` si la cobertura desde 2016 es de al menos 80 % **y** hay dato en
las últimas 8 semanas.

**Resultado: 116 pares utilizables.**

| Producto | Mercados utilizables | Mercados no utilizables (cobertura desde 2016, última semana) |
|---|---|---|
| Papa parda pastusa | 6 | Medellín (3 %, 2019), Chiquinquirá (90 %, sin dato desde 2025-11-24), Tunja (48 %, 2021), Ibagué (0 %, 2015); Barranquilla sin datos |
| Cebolla cabezona blanca | 10 | Cali (0 %, 2013: allí se publica «Cebolla cabezona blanca bogotana») |
| Cebolla junca | 5 | Chiquinquirá (16 %, 2017), Ibagué (0 %, 2013); Bogotá, Cali, Barranquilla y Tunja sin datos |
| Cebolla junca Aquitania | 5 | Barranquilla (32 %, 2023), Bucaramanga (22 %, 2018) |
| Tomate chonto | 8 | Cali (79 %, justo bajo el umbral); Medellín y Bucaramanga sin datos |
| Zanahoria | 7 | Cali (85 %, sin dato desde 2025-07), Barranquilla (39 %), Medellín (0 %, 2014), Pereira (0 %, 2014) |
| Habichuela | 11 | Ninguna |
| Arveja verde en vaina | 10 | Cali sin datos (publica «Arveja verde en vaina pastusa») |
| Plátano hartón verde | 10 | Cartago sin datos |
| Cilantro | 11 | Ninguna |
| Mora de Castilla | 11 | Ninguna |
| Lulo | 11 | Ninguna |
| Pimentón | 11 | Ninguna |

### 6.1 Grupos comparables

`comparable_group = <nombre normalizado>|<unidad>`. Solo los precios del mismo grupo se comparan entre mercados.
Por ejemplo, la Papa parda pastusa de Bogotá y la de Chiquinquirá están en `papa-parda-pastusa|kg`, mientras que la
Papa nevada de Medellín no tiene id y no entra en ninguna comparación. Hay **13 grupos comparables** y todos tienen
al menos 2 mercados utilizables:

| Grupo | Mercados utilizables |
|---|---|
| cilantro\|kg, habichuela\|kg, lulo\|kg, mora-de-castilla\|kg, pimenton\|kg | 11 |
| arveja-verde-en-vaina\|kg, cebolla-cabezona-blanca\|kg, platano-harton-verde\|kg | 10 |
| tomate-chonto\|kg | 8 |
| zanahoria\|kg | 7 |
| papa-parda-pastusa\|kg | 6 |
| cebolla-junca\|kg, cebolla-junca-aquitania\|kg | 5 |

## 7. Esquema de tablas

| Tabla | Filas | Contenido |
|---|---|---|
| `products` | 13 | product_id, canonical_name, family, variety, group |
| `product_mapping` | 31 | source (prices/supply), source_name, product_id, method (exact/normalized), cpc_code |
| `markets` | 11 | market_id, market_name, city, department, latitude, longitude |
| `market_mapping` | 21 | source, source_name, market_id, method (exact/normalized/alias) |
| `price_files` | 729 | file_name, label, label_start, label_end, label_days, iso_year, iso_week, status, rows_read, layout, note |
| `prices` | 3.273.093 | id, week_start, week_end, iso_year, iso_week, product_name (publicado), product_id, variety, market_name (publicado), market_id, min_price, max_price, mean_price, unit, range_inconsistent. El archivo de origen se obtiene uniendo con `price_files` por (iso_year, iso_week): cada semana ISO viene de un solo anexo, y el pipeline falla si dejara de ser así |
| `price_exclusions` | 724 | mismas columnas que `prices` más source_file, reason y detail |
| `coverage` | 130 | product_id, market_id, first_week, last_week, n_weeks, weeks_since_2016, missing_share_since_2016, has_recent_data, usable_for_model, comparable_group |
| `origin_departments` | 33 | code, name |
| `origin_municipalities` | 1.095 | code, name, department_code |
| `supply` | 502.150 | id, iso_year, iso_week, market_id, product_id, origin_department_code, origin_municipality_code, origin_country, quantity_kg |
| `supply_weekly` | 59.094 | iso_year, iso_week, market_id, product_id, quantity_kg |
| `pipeline_log` | 23 | step, level, message, value (archivos excluidos, conteos por regla, correcciones de origen, mercados nuevos por año) |

Los precios están en pesos colombianos corrientes por unidad (`unit`). Las fechas se guardan como texto ISO
`AAAA-MM-DD`. `product_id` y `market_id` están vacíos fuera del conjunto foco.

## 8. Fuera de alcance

En `prices` se cargan todos los productos y mercados con el nombre publicado, pero solo el conjunto foco tiene id;
los demás quedan con `product_id` o `market_id` vacío. En abastecimiento, las filas fuera del foco no se guardan en
la base y se conservan en la caché parquet (sección 4). **No son revisiones pendientes**: se
dejaron fuera a propósito y se pueden incorporar después, agregándolos a `focus.py` y regenerando el catálogo con
`python -m backend.scripts.generate_catalog`.

| | Precios | Abastecimiento |
|---|---|---|
| Filas de productos no foco | 2.977.873 de 3.273.093 (en la base, sin `product_id`) | 17.796.825 de 23.390.309 (solo en caché) |
| Productos distintos fuera de alcance (tras normalizar) | 388 (668 escrituras) | 186 |
| Filas de mercados no foco | 2.356.351 (en la base, sin `market_id`) | 9.291.832 (solo en caché) |
| Mercados distintos fuera de alcance (precios y abastecimiento) | 160 | |
| Filas diarias con producto y mercado foco | 85.026 | 3.323.960 (guardadas como 502.150 filas semanales) |
| Filas de productos foco en mercados no foco | 210.194 | |

<details><summary>Productos de precios fuera de alcance (388)</summary>

Aceite de palma · Aceite Girasol · Aceite Soya · Aceite Vegetal Mezcla · Acelga · Aguacate Choquette · Aguacate Común · Aguacate Hass · Aguacate Papelillo · Ahuyama · Ahuyamín (Sakata) · Ají dulce · Ají Topito Dulce · Ajo · Ajo Importado · Alas de Pollo con Costillar · Alas de Pollo sin Costillar · Almejas con Concha · Almejas sin Concha · Apio · Arándano · Arracacha Amarilla · Arracacha Blanca · Arroz blanco empacado · Arroz blanco en bulto · Arroz Blanco Importado · Arroz cristal · Arroz de Primera · Arroz de Segunda · Arroz Excelso · Arroz granza · Arroz paddy verde · Arroz Sopa Cristal · Arveja Amarilla Seca Importada · Arveja Enlatada · Arveja Verde en Vaina Pastusa · Arveja Verde Seca Importada · Avena en Hojuelas · Avena Molida · Azúcar Morena · Azúcar Refinada · Azúcar Sulfitada · Badea · Bagre Rayado en Postas Congelado · Bagre Rayado Entero Congelado · Bagre Rayado Entero Fresco · Banano Bocadillo · Banano Criollo · Banano Urabá · Basa, Entero Congelado Importado · Basa, Filete Congelado Importado · Berenjena · Blanquillo Entero Fresco · Bocachico Criollo Fresco · Bocachico Importado Congelado · Bocadillo Veleño · Borojó · Breva · Brócoli · Cachama de Cultivo Fresca · Café Instantáneo · Café Molido · Calabacín · Calabaza · Calamar Anillos · Calamar Blanco Entero · Calamar Morado Entero · Camarón Tigre Precocido Seco · Camarón Tití Precocido Seco · Capaz Magdalena Fresco · Carne de Cerdo, Brazo con Hueso · Carne de Cerdo, Brazo sin Hueso · Carne de Cerdo, Cabeza de Lomo · Carne de cerdo, chuleta de lomo · Carne de Cerdo, Costilla · Carne de Cerdo en Canal · Carne de Cerdo, Espinazo · Carne de Cerdo, Lomo con Hueso · Carne de Cerdo, Lomo sin Hueso · Carne de Cerdo, Pernil con Hueso · Carne de Cerdo, Pernil sin Hueso · Carne de Cerdo, Tocineta Plancha · Carne de Cerdo, Tocino Barriga · Carne de Cerdo, Tocino Papada · Carne de Res, Bola de Brazo · Carne de Res, Bola de Pierna · Carne de Res, Bota · Carne de Res, Cadera · Carne de Res, Centro de Pierna · Carne de Res, Chatas · Carne de Res, Cogote · Carne de Res, Costilla · Carne de Res en Canal · Carne de Res, Falda · Carne de Res, Lomo de Brazo · Carne de Res, Lomo Fino · Carne de Res Molida, Murillo · Carne de Res, Morrillo · Carne de Res, Muchacho · Carne de Res, Murillo · Carne de Res, Paletero · Carne de Res, Pecho · Carne de Res, Punta de Anca · Carne de Res, Sobrebarriga · Cazuela de Mariscos (Paquete) · Cebolla Cabezona Blanca Bogotana · Cebolla cabezona blanca ecuatoriana · Cebolla Cabezona Blanca Importada · Cebolla Cabezona Blanca Pastusa · Cebolla cabezona blanca peruana · Cebolla Cabezona Roja · Cebolla cabezona roja ecuatoriana · Cebolla Cabezona Roja Importada · Cebolla Cabezona Roja Ocañera · Cebolla Cabezona Roja Peruana · Cebolla Junca Berlín · Cebolla Junca Pastusa · Cebolla Junca Tenerife · Cebolla Puerro · Cebollín Chino · Chocolate Amargo · Chocolate Dulce · Chocolate Instantáneo · Chócolo Mazorca · Cidra · Ciruela Importada · Ciruela negra chilena · Ciruela negra importada · Ciruela Roja · Ciruela roja importada · Coco · Coles · Coliflor · Color (Bolsita) · Corvina, Filete Congelado Nacional · Cuchuco de Cebada · Cuchuco de Maíz · Curuba · Curuba larga · Curuba redonda · Durazno importado · Durazno Nacional · Espinaca · Fécula de Maíz · Feijoa · Fresa · Fríjol Bolón · Fríjol Cabeza Negra Importado · Fríjol Cabeza Negra Nacional · Fríjol Calima · Fríjol Cargamanto Blanco · Fríjol Cargamanto Rojo · Fríjol Enlatado · Fríjol Nima Calima · Fríjol Palomito Importado · Fríjol Radical · Fríjol Uribe Rosado · Fríjol Verde Bolo · Fríjol Verde Cargamanto · Fríjol Verde en Vaina · Fríjol Zaragoza · Galletas Dulces Redondas con Crema · Galletas Saladas · Galletas saladas 3 tacos · Garbanzo Importado · Gelatina · Granadilla · Guanábana · Guayaba Agria · Guayaba Atlántico · Guayaba Común · Guayaba Manzana · Guayaba Pera · Guayaba Pera Valluna · Gulupa · Haba Verde · Habichuela Larga · Harina de arroz · Harina de Trigo · Harina Precocida de Maíz · Higo · Huevo Blanco A · Huevo Blanco AA · Huevo Blanco B · Huevo Blanco Extra · Huevo Rojo A · Huevo Rojo AA · Huevo Rojo B · Huevo Rojo Extra · Jugo de Frutas · Jugo Instantáneo (Sobre) · Kiwi · Langostino 16-20 · Langostino U12 · Leche en Polvo · Lechuga Batavia · Lechuga crespa morada · Lechuga Crespa Verde · Lenteja Importada · Lenteja nacional · Limón Común · Limón Común Ciénaga · Limón común ecuatoriano · Limón Común Valluno · Limón Mandarino · Limón Tahití · Lomitos de Atún en Lata · Maíz Amarillo Cáscara · Maíz Amarillo Cáscara Importado · Maíz amarillo retrillado · Maíz Amarillo Trillado · Maíz Blanco Cáscara · Maíz Blanco Retrillado · Maíz Blanco Trillado · Maíz Enlatado · Maíz Pira · Mandarina Arrayana · Mandarina Común · Mandarina Oneco · Mango Común · Mango costeño · Mango de Azúcar · Mango Kent · Mango Manzano · Mango mariquiteño · Mango Reina · Mango Tommy · Mango Yulima · Manteca · Manzana Nacional · Manzana Roja Importada · Manzana Royal Gala Importada · Manzana Verde Importada · Maracuyá · Maracuyá Antioqueño · Maracuyá Huilense · Maracuyá Santandereano · Maracuyá Valluno · Margarina · Mayonesa Doy Pack · Melón Cantalup · Menudencias de Pollo · Merluza, Filete Importado · Merluza, Filete Nacional · Mojarra Lora Entera Congelada · Mojarra Lora Entera Fresca · Mostaza Doy Pack · Muslos de Pollo con Rabadilla · Muslos de Pollo sin Rabadilla · Ñame Criollo · Ñame Diamante · Ñame Espino · Naranja Común · Naranja Sweet · Naranja Valencia · Nicuro Fresco · Palmitos de Mar · Panela Cuadrada Blanca · Panela Cuadrada Morena · Panela en Pastilla · Panela pulverizada · Panela Redonda Blanca · Panela Redonda Morena · Papa Betina · Papa Capira · Papa capira carmenia · Papa Criolla Limpia · Papa criolla para lavar · Papa Criolla Sucia · Papa frita · Papa Ica-Huila · Papa Morasurco · Papa Nevada · Papa parda para lavar · Papa Puracé · Papa R-12 Negra · Papa R-12 Roja · Papa Roja Peruana · Papa Rubí · Papa ruby · Papa Sabanera · Papa San Félix · Papa Superior · Papa Suprema · Papa tocana · Papa tocarreña · Papa Única · Papaya Hawaiana · Papaya Maradol · Papaya melona · Papaya Paulina · Papaya redonda · Papaya Tainung · Pargo Rojo Entero Congelado · Pargo rojo entero fresco · Pargo Rojo Platero · Pastas Alimenticias · Patilla · Patilla Baby · Pechuga de Pollo · Pepino Cohombro · Pepino de Rellenar · Pera Importada · Pera Nacional · Perejil · Pescado Cabezas · Pierna Pernil con Rabadilla · Pierna Pernil sin Rabadilla · Piernas de Pollo · Pimentón Verde · Piña Cayena · Piña Gold · Piña Manzana · Piña Perolera · Pitahaya · Plátano Comino · Plátano Dominico Hartón Maduro · Plátano Dominico Hartón Verde · Plátano Dominico Verde · Plátano Guineo · Plátano Hartón Maduro · Plátano Hartón Verde Ecuatoriano · Plátano Hartón Verde Eje Cafetero · Plátano Hartón Verde Llanero · Plátano hartón verde venezolano · Pollo entero congelado con vísceras · Pollo Entero Congelado sin Vísceras · Pollo entero fresco con vísceras · Pollo Entero Fresco sin Vísceras · Queso Campesino · Queso Caquetá · Queso Costeño · Queso Cuajada · Queso Doble Crema · Rabadillas de Pollo · Rábano Rojo · Remolacha · Remolacha antioqueña · Remolacha Bogotana · Remolacha Regional · Repollo Blanco · Repollo Blanco Bogotano · Repollo Blanco Valluno · Repollo Morado · Repollo morado antioqueño · Repollo Verde · Repollo verde regional · Róbalo, Filete Congelado · Sal Yodada · Salmón, Filete Congelado · Salsa de Tomate Doy Pack · Sardinas en Lata · Sierra Entera Congelada · Sopa de Pollo (Caja) · Tangelo · Tilapia, Filete Congelado · Tilapia, lomitos · Tilapia Roja Entera Congelada · Tilapia Roja Entera Fresca · Tomate chonto antioqueño · Tomate Chonto Regional · Tomate Chonto Valluno · Tomate de Árbol · Tomate Larga Vida · Tomate Riñón · Tomate Riñón Valluno · Tomate Riogrande · Tomate Riogrande Bumangués · Tomate Riogrande Ocañero · Toyo blanco, filete congelado · Trucha en Corte Mariposa · Trucha Entera Fresca · Uchuva con Cáscara · Ulluco · Uva Importada · Uva Isabela · Uva negra · Uva Red Globe Nacional · Uva Roja · Uva Verde · Vinagre · Yuca Chirosa · Yuca Criolla · Yuca Ica · Yuca Llanera · Zanahoria Bogotana · Zanahoria Larga Vida · Zapote

</details>

<details><summary>Productos de abastecimiento fuera de alcance (186)</summary>

Aceites · Acelga · Agua envasada · Aguacate Choquette · Aguacate común · Aguacate Hass · Aguacate papelillo · Aguacates otros · Ahuyama · Ají topito dulce · Ajo · Apio · Arracacha · Arroz · Arveja seca importada · Atún en lata · Avena · Azúcar · Bagre · Banano bocadillo · Banano criollo · Banano Urabá · Bananos otros · Basa · Bebidas alcohólicas · Bebidas lácteas · Bebidas otras · Berenjena · Bocachico · Brócoli · Cachama · Café · Calabacín · Calabaza · Camarón · Carne de cerdo · Carne de pollo · Carne de res · Carnes frias y embutidos · Carnes otras · Cebolla Cabezona · Cebolla cabezona roja · Cebolla puerro · Cerdo en pie · Cereales otros · Cereales para desayuno · Cervezas · Chocolate · Chócolo mazorca · Cidra · Ciruela importada · Ciruela nacional · Coco · Coliflor · Condimentos · Confitería · Conservas y enlatados · Cremas y sopas · Curuba · Durazno importado · Durazno nacional · Espinaca · Fresa · Fríjol · Fríjol verde · Frutas importadas otras · Frutas otras · Galletas · Gallina en pie · Garbanzo · Gaseosas y maltas · Granadilla · Granos Secos · Grasas · Guanábana · Guayaba común · Guayaba pera · Guayabas otras · Gulupa · Harinas · Hierbas aromáticas y medicinales · Hortalizas de hoja · Huevo · Huevos otros · Jengibre · Jugo de frutas · Kiwi · Lácteos otros · Leche cruda · Leche en polvo · Leche pasteurizada UHT · Lechuga Batavia · Lechuga crespa · Lechugas otras · Lenteja · Limón común · Limón mandarino · Limón Tahití · Limones otros · Maíz Amarillo · Maíz Blanco · Mandarina Arrayana · Mandarina común · Mandarina Oneco · Mandarinas otras · Mango común · Mango de azúcar · Mango Tommy · Mango Yulima · Mangos otros · Manzana importada · Manzana nacional · Maracuyá · Mariscos otros · Melón · Mojarra · Mora · Ñame · Naranja común · Naranja Valencia · Naranja Valencia y/o Sweet · Naranjas otras · Nicuro · Panela · Papa Betina · Papa capira · Papa criolla · Papa Morasurco · Papa nevada · Papa R-12 · Papa rubí · Papa sabanera · Papa superior · Papa suprema · Papa única · Papas negras otras · Papaya hawaiana · Papaya Maradol · Papaya Paulina · Papaya tainung · Papayas otras · Pasabocas · Pastas alimenticias · Patilla · Patilla baby · Pepino cohombro · Pepino de rellenar · Pera importada · Pera nacional · Perejil · Pescado seco · Pescados de mar · Pescados de río · Piña gold · Piña perolera · Piñas otras · Pitahaya · Plátano guineo · Plátanos otros · Pollo en pie · Procesados otros · Productos de panaderia · Queso costeño · Quesos y cuajadas · Remolacha · Repollo · Res en pie · Sal yodada · Salsas y aderezos · Sardinas en lata · Tangelo · Tilapia · Tomate de árbol · Tomate larga vida · Tomate Riogrande · Tomates otros · Trucha · Tubérculos otros · Uchuva · Ulluco · Uva importada · Uva Isabela · Uva nacional · Verduras y hortalizas otras · Yuca · Zapote

</details>

<details><summary>Mercados fuera de alcance (160)</summary>

Acacías (Meta) · Aguazul (Casanare) · Alvarado, La Guaira · Alvarado (Tolima) · Ancuyá (Nariño) · Arauca (Arauca) · Armenia, Frigocafé · Armenia, Retiro · Barranquilla (Atlántico) · Barranquilla, Granabastos · Bogotá, D.C., Carnes barrio María Paz · Bogotá, D.C., Frigorífico Ble Ltda. · Bogotá, D.C., Frigorífico Guadalupe · Bogotá, D.C., Frigorífico San Martín · Bogotá, D.C., Paloquemao · Bogotá, D.C., Plaza España · Bogotá, D.C., Plaza Las Flores · Bogotá, D.C., Plaza Samper Mendoza · Bucaramanga, Arrocera El Dorado · Bucaramanga, Arrocera El Libertador y Molino Comun · Bucaramanga, Frigoríficos · Bucaramanga, Mercados del centro · Bucaramanga (Santander) · Buenaventura (Valle del Cauca) · Cajamarca (Tolima) · Cali, Galería Alameda · Cali, La Floresta · Cali, Santa Helena · Cali, Siloé · Campoalegre (Huila) · Campoalegre, Molino Flor Huila S.A. · Campoalegre, Molino San Isidro del Huila Ltda. · Caparrapí (Cundinamarca) · Cartagena, Bazurto · Cartagena, Frigorífico Candelaria · Cereté, Corgranos S.A. · Charalá (Santander) · Consacá (Nariño) · Cúcuta, Arrocera Agua Blanca · Cúcuta, Arrocera Agua Clara · Cúcuta, Arrocera Éxito · Cúcuta, Arrocera Gelvez · Cúcuta, Arrocera San Valentín · Cúcuta, Cenabastos · Cúcuta, Comercializadora Gomez y Gomez S.A.S. · Cúcuta, Cooagronorte Ltda. · Cúcuta, Inveragro San Andres S.A.S · Cúcuta, La Nueva Sexta · Cúcuta (Norte de Santander) · Duitama (Boyacá) · Duitama (Boyacá), Mercaplaza · El Carmen de Viboral (Antioquia) · El Santuario (Antioquia) · Espinal, Arroz Caribe · Espinal, Molino Diana Corporación S.A · Espinal, Molino Grande · Espinal, Molino OFD · Espinal (Tolima) · Espinal, Union de Arroceros · Florencia (Caquetá) · Granada (Meta) · Güepsa (Santander) · Honda (Tolima) · Ibagué, Frigorífico Carlima · Ibagué, Molino del Arroz · Ibagué, Molino Federal · Ibagué, Plaza El Jardín · Ibagué, Proarroz · Ibagué (Tolima) · Ibagué, Union de Arroceros · Ipiales, Centro de Acopio · Ipiales, Mercado de Ipiales Somos Todos · Ipiales (Nariño) · La Ceja (Antioquia) · La Dorada (Caldas) · La Parada (Norte de Santander) · La Unión (Antioquia) · La Unión (Nariño) · La Virginia (Risaralda) · Lérida, Molino Diana Corporación S.A · Lérida, Molino Los Andes · Lérida (Tolima) · Magangué (Bolívar) · Malambo, Atlantico · Malambo (Atlántico), Carnes y carnes · Manizales (Caldas) · Manizales, Centro Galerías · Marinilla (Antioquia) · Medellín, Coomerca · Medellín, Placita de Flórez · Medellín, Plaza Minorista "José María Villa" · Moniquirá (Boyacá) · Montería (Córdoba) · Montería, Frigosinú · Montería, Mercado del Sur · Neiva (Huila) · Neiva, Molino Roa S.A. · Neiva, Surabastos · Nocaima (Cundinamarca) · Palmira (Valle del Cauca) · Pamplona (Norte de Santander) · Pasto, El Potrerillo · Pasto (Nariño) · Peñol (Antioquia) · Pereira, La 41 · Pereira, La 41-Impala · Pereira, La Bella · Planeta Rica (Córdoba) · Popayán (Cauca) · Popayán, Plaza de mercado del barrio Bolívar · Puente Nacional (Santander) · Purificación, Agroindustrial Molino Sonora S.A.S. · Purificación (Tolima) · Rionegro (Antioquia) · Rivera, Diana Corporación S.A.S · Rivera (Huila) · Sahagún (Córdoba) · San Andrés de Tumaco (Nariño) · San Bernardo del Viento (Córdoba) · San Gil (Santander) · San Gil (Santander)panela · San José de Cúcuta (Norte de Santander) · San Marcos, Arrocera Formosa · San Marcos (Sucre) · San Martín (Meta) · San Sebastián de Mariquita (Tolima) · San Sebastián de Mariquita (Tolima), panela · San Vicente (Antioquia) · San Vicente Ferrer (Antioquia) · Sandoná (Nariño) · Santa Bárbara (Antioquia) · Santa Marta (Magdalena) · Santana (Boyacá) · Sincelejo, Nuevo Mercado · Sincelejo (Sucre) · Socorro (Santander) · Sogamoso (Boyacá) · Sonsón (Antioquia) · Tibasosa (Boyacá), Coomproriente · Tuluá (Valle del Cauca) · Tunja (Boyacá) · Túquerres (Nariño) · Ubaté (Cundinamarca) · Valledupar (Cesar) · Valledupar, Mercabastos · Valledupar, Mercado Nuevo · Vélez (Santander) · Venadillo, Arrocera Boluga Ltda. · Venadillo, Inversiones Molino Colombia S.A.S. · Venadillo, Molino Caribe · Venadillo, Molino Tonoli · Venadillo (Tolima) · Villanueva (Casanare) · Villavicencio, CAV · Villavicencio, Llanoabastos · Villavicencio (Meta) · Villeta (Cundinamarca) · Yarumal (Antioquia) · Yolombó (Antioquia) · Yopal (Casanare)

</details>

## 9. Limitaciones conocidas

- **Precios corrientes**: no están deflactados. La inflación de 2012 a 2026 introduce una tendencia.
- **Semanas faltantes**: 3 semanas ISO entre 2012-W46 y 2026-W46 no tienen boletín. El modelo debe tolerar huecos.
- **Boletines de festivos**: aunque se asignan a una sola semana ISO, cubren entre 4 y 9 días, así que el precio
  medio de esas semanas no es estrictamente comparable con el de una semana normal.
- **Cambios de nombre de mercados**: «Tunja (Boyacá)» (hasta 2016-04) y «Tunja, Complejo de Servicios del Sur»
  (desde 2016-04) podrían ser el mismo mercado, igual que «Pasto (Nariño)» y «Pasto, El Potrerillo», pero no se
  unieron por falta de confirmación. Solo se unieron variantes de escritura (`MARKET_ALIASES`).
- **Regla de saltos de unidad**: usa la mediana de la serie como ancla. Si una serie tuviera más de la mitad de sus
  semanas en la unidad equivocada, se excluirían las semanas correctas. No ocurre en el conjunto foco, donde la
  regla no excluyó ninguna fila.
- **Duplicados en conflicto**: en los 74 casos se conserva el boletín más reciente, sin una verificación externa de
  cuál precio es el correcto.
- **Municipios**: el nombre es el más frecuente publicado para cada código, no el de una tabla DIVIPOLA oficial de
  municipios.
- **Abastecimiento y precios no comparten catálogo**: el abastecimiento publica categorías agregadas («Papa
  criolla», «Mora», «Hortalizas de hoja») que no corresponden a una sola variedad de precios.
- **Tamaño**: `mercao.db` ocupa 406 MB y está excluida de git. Casi todo es la tabla `prices` (3,3 millones de filas
  de todos los productos, con los nombres publicados de producto y mercado en cada fila, como pide el diseño).
- **Abastecimiento semanal**: la base no guarda el detalle diario; quien necesite fechas exactas debe leer la caché
  parquet de `data/interim/pipeline/supply/`.