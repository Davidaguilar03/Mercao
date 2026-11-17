# Marca Mercao

Guía corta de la identidad de Mercao: logo, colores, tipografía y forma de hablar. Los valores de esta guía están
definidos como variables CSS en `frontend/src/styles/tokens.css`; si cambia uno, cámbielo en los dos lugares.

## Nombre y lema

- Nombre: **Mercao** (de "mercado", como se dice en la plaza). Se escribe con mayúscula inicial y sin tilde.
- Lema: **Precios de plaza, claros.**

## Logo

Un canasto tejido con una papa, un tomate y una hoja, y una flecha de tendencia que sube sobre ellos. El canasto es la
plaza de mercado; la flecha, los datos y el pronóstico.

| Archivo | Uso |
|---|---|
| `frontend/src/assets/brand/logo.png` | Logo con fondo transparente (299 × 320 px) para la interfaz |
| `frontend/public/favicon.ico` | Ícono de la pestaña del navegador (16, 32 y 48 px) |
| `frontend/public/icons/icon-192.png`, `icon-512.png` | Íconos del manifiesto web |

En el encabezado el logo va a la izquierda del nombre "Mercao" escrito en Fraunces, con el lema debajo.

### Uso correcto

- Úselo sobre blanco o sobre el crema de fondo (`#F7F1E3`). Sobre fotos o colores fuertes, póngalo dentro de una
  superficie blanca.
- Deje alrededor un espacio libre de al menos una cuarta parte del ancho del logo.
- Tamaño mínimo: 32 px de alto en pantalla. Por debajo de eso use el favicon.
- Mantenga las proporciones.

### Uso incorrecto

- No lo deforme, no lo gire ni le cambie los colores.
- No le agregue sombras, bordes ni efectos.
- No lo ponga directamente sobre el verde principal ni sobre fondos oscuros: el asa y el borde del canasto se
  pierden. En el pie de página, que es verde, va dentro de un círculo crema.
- No use la versión antigua con fondo crema incorporado.

## Paleta

Los colores salen del logo.

| Nombre | Hex | Variable | Uso |
|---|---|---|---|
| Verde plaza (principal) | `#1F6B4A` | `--color-primary` | Nombre de la marca, enlaces, botones, pie de página |
| Verde oscuro | `#17523A` | `--color-primary-strong` | Estados al pasar el cursor o presionar |
| Verde suave | `#E4F1EA` | `--color-primary-soft` | Fondos de selección y de "precio sube" |
| Amarillo maíz (acento) | `#F2B705` | `--color-accent` | Detalles: subrayado de la página actual, borde de avisos, plaza más barata |
| Terracota | `#C8553D` | `--color-terracotta` | Íconos y formas (flecha de "precio baja"); no para texto pequeño |
| Terracota para texto | `#A8402A` | `--color-terracotta-text` | Texto de "precio baja" y mensajes de error |
| Terracota suave | `#FBEAE5` | `--color-terracotta-soft` | Fondo de "precio baja" |
| Crema (fondo) | `#F7F1E3` | `--color-background` | Fondo de la página |
| Blanco (superficies) | `#FFFFFF` | `--color-surface` | Tarjetas, encabezado, campos |
| Tinta | `#1E2B24` | `--color-ink` | Texto principal |
| Texto secundario | `#55635B` | `--color-muted` | Notas, unidades, descripciones |
| Borde de tarjetas | `#6D9F89` | `--color-card-border` | Contorno de 1 px de tarjetas y contenedores (3,0:1 sobre blanco, 2,7:1 sobre crema) |
| Verde muy suave | `#EEF5F0` | `--color-surface-tint` | Fondo de la franja de título y fila resaltada en tablas |
| Foco | `#17523A` | `--color-focus` | Contorno del elemento activo al navegar con teclado (9,1:1 sobre blanco) |
| Línea | `#E3DCCB` | `--color-border` | Líneas de tablas y separadores |
| Borde fuerte | `#8A8F80` | `--color-border-strong` | Contorno de campos; serie de referencia en gráficas |

### Colores con significado

Mercao usa dos familias de color con significado, y no se mezclan.

**Cambio de precio** (subió o bajó frente a otra fecha, o lo que se espera frente al último precio). Sigue la
convención de los mercados: verde si sube, rojo si baja.

| Significado | Texto | Fondo | Ícono |
|---|---|---|---|
| El precio sube | `#1F6B4A` | `#E4F1EA` | Flecha hacia arriba, verde |
| El precio baja | `#A8402A` | `#FBEAE5` | Flecha hacia abajo, terracota `#C8553D` |
| Sin cambio o sin dato | `#55635B` | `#EEEBE2` | Raya |

El color nunca va solo: siempre lo acompañan una flecha y el número con su signo. El texto de una baja usa el
terracota oscuro, que sí cumple contraste; el terracota del logo queda para la flecha.

**Nivel de precio** (una plaza frente a las demás que venden la misma variedad, o un mes frente al resto del año). No
es un cambio, así que no usa verde ni rojo: usa amarillo maíz, blanco y tinta, con un ícono dentro de un círculo.

| Significado | Fondo | Ícono | Forma del ícono |
|---|---|---|---|
| Más barata que la mayoría | `#F2B705` | `#1E2B24` | Flecha recta hacia abajo |
| Precio parecido al de la mayoría | `#FFFFFF` con borde tinta | `#1E2B24` | Signo igual |
| Más cara que la mayoría | `#1E2B24` | `#FFFFFF` | Flecha recta hacia arriba |

Estos íconos aparecen en el mapa, en su leyenda y en la tabla de plazas de Panorama, siempre con su significado
escrito al lado. Comparan el precio de una plaza con el de las demás plazas de la misma variedad en la misma semana;
no dicen si el precio cambió con el tiempo. Se distinguen de un cambio de precio por el color (nunca verde ni rojo),
por la forma (flecha recta dentro de un círculo, no la flecha quebrada de tendencia) y porque no llevan porcentaje. Los mismos dos colores
distinguen dónde comprar (amarillo, la plaza barata) y dónde vender (tinta, la plaza cara) en Oportunidades, y el mes
más barato y el más caro en la gráfica de temporadas. La leyenda del mapa aclara que las marcas no dicen si el precio
subió o bajó.

### Contraste

Todos los colores de texto cumplen el nivel AA de WCAG 2.1 (mínimo 4,5:1 para texto normal):

| Texto | Sobre blanco | Sobre crema | Sobre su fondo suave |
|---|---|---|---|
| Tinta `#1E2B24` | 14,7:1 | 13,1:1 | |
| Texto secundario `#55635B` | 6,3:1 | 5,6:1 | 5,3:1 |
| Verde `#1F6B4A` | 6,4:1 | 5,7:1 | 5,5:1 |
| Terracota para texto `#A8402A` | 6,1:1 | 5,4:1 | 5,3:1 |
| Blanco sobre verde `#1F6B4A` | 6,4:1 | | |
| Crema `#F7F1E3` sobre verde `#1F6B4A` (pie de página) | 5,7:1 | | |

El terracota del logo (`#C8553D`) llega a 4,35:1 sobre blanco y 3,9:1 sobre crema: no alcanza para texto normal, por
eso el texto usa la variante más oscura. El amarillo maíz no se usa para texto; si lleva texto encima, va en tinta
(8,1:1).

## Ilustración

Mercao tiene una ilustración de línea en el verde de la marca, con el mismo trazo redondeado del logo. Son quince
dibujos de la plaza de mercado: canasto, bulto, guacal, balanza, puesto con toldo, carretilla, etiqueta de precio,
papa, tomate, cebolla, zanahoria, plátano, hoja y dos líneas de tendencia. Todos se dibujan en una caja de 64 × 64
con trazo de 2 px y puntas redondeadas, en SVG dentro del código (`frontend/src/components/illustrations/`), así que
no pesan ni dependen de internet.

- **Franja de título.** Cada página empieza con una franja blanca que se degrada a verde muy suave. Lleva el
  título, la descripción, los selectores de la página y una escena pequeña de la plaza (puesto, canasto, bulto,
  guacal y tendencia). En celulares solo se asoma una esquina de la escena, muy tenue.
- **Costados.** Desde 1200 px de ancho los dibujos forman una cinta a cada lado del contenido, ocho por lado, que
  alterna recipientes, productos y señales del oficio. En portátiles la cinta cabe en el margen de 64 px y va al
  14 % de opacidad; en pantallas anchas los dibujos crecen y se reparten por el margen libre, al 11 %. Nunca van
  detrás de textos, controles, tablas ni gráficas.
- **Pie de página.** La escena se repite pequeña, en crema, en la franja inferior del pie.
- Es solo decoración: no lleva texto, no se anima y los lectores de pantalla la ignoran.
- No la use a color, con relleno ni como reemplazo del logo.

## Tarjetas y cifras

- Todas las tarjetas y contenedores llevan el mismo contorno verde de 1 px, radio de 16 px y una sombra suave
  (`--shadow-card`). Cada tarjeta ocupa solo el alto de su contenido.
- Las cifras clave usan un mismo sistema: rótulo pequeño en mayúsculas, cifra grande y una explicación corta.
  Cuando la tarjeta es ancha, la explicación va a la derecha de la cifra para que la tarjeta no quede con espacio
  vacío; cuando es angosta o el texto es largo, va debajo. Precios y porcentajes van del mismo tamaño. Un
  porcentaje lleva flecha y color: verde si sube, rojo si baja.
- El rango probable de un pronóstico se dibuja como una barra corta con un punto en el precio esperado.

## Distribución de las páginas

- Hasta 1199 px de ancho todo va en una columna. Desde 1200 px el contenido se ensancha (hasta 1480 px) y Panorama
  y Producto usan dos columnas, para ver lo principal con poco desplazamiento en pantallas de 1366 × 768 en adelante.
- Panorama: a la izquierda el título con el selector, la frase resumen y el mapa; a la derecha la tabla de plazas
  (que se desplaza dentro de su tarjeta si no cabe) y el origen.
- Producto: a la izquierda los selectores, las cifras clave y la gráfica de precios; a la derecha temporadas,
  departamentos y municipios. De los municipios se muestran cinco, con un botón "Ver más" para ver los diez.
- La lista del selector de productos se abre por encima de las tarjetas que siguen a la franja de título y se
  desplaza por dentro; la franja no recorta su contenido.
- Oportunidades y Cómo funciona ocupan todo el ancho y reparten sus bloques en dos o tres columnas.

## Pie de página

Fondo verde principal con texto crema y una línea amarillo maíz arriba. Lleva el logo dentro de un círculo crema con
el nombre y el lema, una descripción corta, la fuente de los datos y la última semana con datos, los cuatro autores
(David Aguilar Castillo, Valeria Tocarruncho Mosquera, Andrés Santiago Daza Quintana y Oscar Alejandro Roa Doncel) y,
en una franja más oscura, el nombre de la materia y la universidad. No lleva enlaces.

## Tipografía

| Uso | Fuente | Variable |
|---|---|---|
| Títulos y nombre de la marca | Fraunces (serif, variable) | `--font-display` |
| Texto, tablas y números | Inter (sans-serif, variable) | `--font-body` |

Las dos fuentes van dentro de la aplicación (paquetes `@fontsource-variable`), así que no dependen de internet.

- Títulos en Fraunces, peso 600. El nombre "Mercao" va en peso 700 y en verde.
- Texto en Inter, 16 px de base e interlineado 1,55.
- Precios y porcentajes con cifras tabulares (`font-variant-numeric: tabular-nums`) para que queden alineados en
  columnas.

### Cómo se escriben los números

- Precios en pesos por kilo, sin decimales y con punto de miles: `$ 2.350 /kg`.
- Porcentajes con un decimal y coma: `12,5 %`. Los cambios llevan signo: `+12,5 %`, `−10,4 %`.
- Fechas completas: `9 de noviembre de 2026`.

## Espacios, bordes y sombras

- Espaciado en múltiplos de 4 px: 4, 8, 12, 16, 24, 32, 48 y 64 (`--space-1` a `--space-8`).
- Radios: 6 px (elementos pequeños), 10 px (campos y botones), 16 px (tarjetas) y píldora para etiquetas.
- Sombras suaves y de un solo tono (`--shadow-sm`, `--shadow-md`, `--shadow-lg`).
- Tamaños de pantalla: desde 360 px (celulares); 480 px, 768 px (aparece el menú horizontal), 1024 px y 1200 px
  (dos columnas y dibujos en los costados).
- Botones y enlaces del menú miden al menos 44 px de alto para que se puedan tocar con el dedo.

## Tono de voz

Mercao habla como alguien de confianza que conoce la plaza y sabe de números: claro, cercano y sin enredos.

- **Claro.** Frases cortas. Primero el dato, después la explicación.
- **Cercano.** Español de Colombia, tratando de "usted". Palabras de la plaza: plaza, carga, bulto, flete.
- **Sin jerga.** Nada de términos técnicos sin explicar. "Error promedio" en vez de "MAPE"; "rango probable" en vez
  de "intervalo de predicción".
- **Honesto.** Un pronóstico es una estimación y se dice así. No se promete ganancia ni se exagera la precisión.
- **Sin adornos.** Sin emojis, sin signos de exclamación de más y sin mayúsculas sostenidas.

| En vez de | Escriba |
|---|---|
| "MAPE de 14 % en el conjunto de prueba" | "En promedio se equivoca en 14 %" |
| "No hay registros para los parámetros seleccionados" | "No hay datos de este producto en esta plaza" |
| "Oportunidad de arbitraje" | "Dónde comprar y dónde vender" |
| "Error 500" | "Algo salió mal. Intente de nuevo en un momento." |
