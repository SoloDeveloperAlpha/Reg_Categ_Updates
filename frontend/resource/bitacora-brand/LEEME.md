# Kit de marca — Bitácora

Logotipo: monograma «B» con barra de acento + nombre en Manrope ExtraBold.

## Qué hay en cada carpeta

| Carpeta | Contenido |
|---|---|
| `svg/` | Logotipos vectoriales (el texto está convertido a trazos, no necesita la fuente): horizontal, vertical, ícono y solo el nombre, en versión clara, oscura, monocroma negra y monocroma blanca. También el favicon, el ícono de aplicación y la imagen para redes. |
| `png/` | Los mismos logotipos en PNG con fondo transparente, en varios tamaños. |
| `favicons/` | `favicon.ico` (16/32/48), `favicon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`. |
| `social/` | `avatar-512.png` e `og-image-1200x630.png` (vista previa al compartir el enlace). |
| `mockups/` | Cinco mockups: aplicación web, inicio de sesión, tarjetas de presentación, íconos y favicon, papel membretado. Los textos entre corchetes son de ejemplo. |
| `marca/` | `colores.css` (variables CSS) y `tokens.json` (colores, fuente y contrastes). |
| `fuente/` | Manrope (variable, 200–800) y su licencia SIL Open Font License. |

## Cuál archivo usar

- Fondo claro: `bitacora-logo-horizontal`. Fondo oscuro: `bitacora-logo-horizontal-dark`.
- Una sola tinta (sellos, fax, grabado): `-mono-black` o `-mono-white`.
- Espacios cuadrados (avatar, ícono de app): `bitacora-icon` o `bitacora-app-icon`.
- Tamaños de 48 px o menos: `bitacora-favicon` (lleva la barra más gruesa para que se vea).

## Paleta

| Nombre | Hex | Uso |
|---|---|---|
| Navy 900 | `#0F1B2D` | Tinta de marca, texto principal, fondos oscuros |
| Blue 600 | `#2B5BD7` | Acción primaria: botones y enlaces sobre fondo claro |
| Blue 500 | `#4C7DF0` | Acento del logotipo, foco, primario sobre fondo oscuro |
| Slate 50 | `#F5F7FA` | Fondo general de la aplicación |
| Blanco | `#FFFFFF` | Tarjetas y superficies |
| Navy 950 / 700 | `#0A1220` / `#22344D` | Fondos y bordes en modo oscuro |
| Slate 600 / 500 / 400 | `#4A5668` / `#5B6778` / `#8A94A3` | Texto secundario / texto de apoyo / iconos inactivos (no texto) |
| Slate 300 / 200 / 100 | `#C9D0DA` / `#E3E7ED` / `#EEF1F5` | Bordes y fondos de bloques |
| Blue 700 / 300 / 100 | `#1F46AE` / `#9DB8F7` / `#E6EDFC` | Hover / acento suave sobre oscuro / selección |
| Correcto | `#0E7C66` sobre `#E3F4EF` | Completado |
| Atención | `#9A4506` sobre `#FDF0DC` | Pendiente |
| Error | `#C0392B` sobre `#FBE7E4` | Crítico |

Proporción sugerida: neutros claros 60 %, navy 25 %, azul de acción 10 %, estados 5 %.
Blue 500 sobre blanco tiene un contraste de 3,8:1, así que úsalo solo en gráficos grandes, nunca en texto pequeño.
Todas las combinaciones de texto de la lista superan 4,5:1 (ver `marca/tokens.json`).

## Tipografía

Manrope para todo. Tamaño / interlineado · peso · espaciado:

| Estilo | Medida | Peso | Espaciado |
|---|---|---|---|
| Display | 56 / 60 | 800 | −3 % |
| Título 1 | 36 / 42 | 800 | −2,5 % |
| Título 2 | 24 / 30 | 700 | −2 % |
| Título 3 | 18 / 26 | 700 | 0 |
| Texto | 16 / 24 | 500 | 0 |
| Pequeño | 14 / 20 | 500 | 0 |
| Etiqueta | 12 / 16 | 700, mayúsculas | +7 % |

Para la web:

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

```css
font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

Si necesitas cargarla sin internet, usa `fuente/Manrope[wght].ttf` con `@font-face`.

## Cabecera HTML sugerida

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:image" content="https://tu-dominio/og-image-1200x630.png">
```

## Uso del logotipo

- Espacio libre: como mínimo, la mitad de la altura del ícono alrededor del logotipo.
- Tamaño mínimo: horizontal 120 px de ancho; ícono 24 px (por debajo, usa el favicon).
- No deformar ni rotar, no cambiar los colores, no añadir sombras ni contornos, no usar la versión clara sobre fondos oscuros ni al revés.
