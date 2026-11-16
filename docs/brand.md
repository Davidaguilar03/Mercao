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
- No lo ponga sobre el verde principal ni sobre fondos oscuros: el asa y el borde del canasto se pierden.
- No use la versión antigua con fondo crema incorporado.

## Paleta

Los colores salen del logo.

| Nombre | Hex | Variable | Uso |
|---|---|---|---|
| Verde plaza (principal) | `#1F6B4A` | `--color-primary` | Nombre de la marca, enlaces, botones, pie de página |
| Verde oscuro | `#17523A` | `--color-primary-strong` | Estados al pasar el cursor o presionar |
| Verde suave | `#E4F1EA` | `--color-primary-soft` | Fondos de selección y de "precio baja" |
| Amarillo maíz (acento) | `#F2B705` | `--color-accent` | Detalles: subrayado de la página actual, foco del teclado |
| Terracota | `#C8553D` | `--color-terracotta` | Íconos y formas; no para texto pequeño |
| Terracota para texto | `#A8402A` | `--color-terracotta-text` | Texto de "precio sube" y mensajes de error |
| Terracota suave | `#FBEAE5` | `--color-terracotta-soft` | Fondo de "precio sube" |
| Crema (fondo) | `#F7F1E3` | `--color-background` | Fondo de la página |
| Blanco (superficies) | `#FFFFFF` | `--color-surface` | Tarjetas, encabezado, campos |
| Tinta | `#1E2B24` | `--color-ink` | Texto principal |
| Texto secundario | `#55635B` | `--color-muted` | Notas, unidades, descripciones |
| Borde | `#E3DCCB` | `--color-border` | Bordes de tarjetas y líneas de tablas |
| Borde fuerte | `#8A8F80` | `--color-border-strong` | Contorno de campos; serie de referencia en gráficas |

### Colores con significado

| Significado | Texto | Fondo | Ícono |
|---|---|---|---|
| El precio sube | `#A8402A` | `#FBEAE5` | Flecha hacia arriba |
| El precio baja | `#1F6B4A` | `#E4F1EA` | Flecha hacia abajo |
| Sin cambio o sin dato | `#55635B` | `#EEEBE2` | Raya |

Que el precio suba se muestra en terracota porque encarece la compra; que baje, en verde. El color nunca va solo:
siempre lo acompañan una flecha y el número con su signo.

### Contraste

Todos los colores de texto cumplen el nivel AA de WCAG 2.1 (mínimo 4,5:1 para texto normal):

| Texto | Sobre blanco | Sobre crema | Sobre su fondo suave |
|---|---|---|---|
| Tinta `#1E2B24` | 14,7:1 | 13,1:1 | |
| Texto secundario `#55635B` | 6,3:1 | 5,6:1 | 5,3:1 |
| Verde `#1F6B4A` | 6,4:1 | 5,7:1 | 5,5:1 |
| Terracota para texto `#A8402A` | 6,1:1 | 5,4:1 | 5,3:1 |
| Blanco sobre verde `#1F6B4A` | 6,4:1 | | |

El terracota del logo (`#C8553D`) llega a 4,35:1 sobre blanco y 3,9:1 sobre crema: no alcanza para texto normal, por
eso el texto usa la variante más oscura. El amarillo maíz no se usa para texto; si lleva texto encima, va en tinta
(8,1:1).

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
- Tamaños de pantalla: desde 360 px (celulares); 480 px, 768 px (aparece el menú horizontal) y 1024 px.
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
