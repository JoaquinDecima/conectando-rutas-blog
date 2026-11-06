# AGENTS.md — Conectando Rutas

Blog estático de viajes construido con **Astro 6 + Tailwind CSS 4 + MDX**. Package manager: **bun**.

## Reglas inquebrantables

1. **TODO el diseño es Once UI.** Cada decisión visual pasa por el sistema de tokens Once UI (port oficial de `@once-ui-system/core` en `src/styles/global.css`). Prohibido inventar colores, tamaños, radios o sombras fuera del sistema.
2. **La performance es EXTREMADAMENTE importante.** Este es un sitio 100% estático con cero JS de frameworks. Ante la duda, menos JS, menos CSS, menos requests.
3. Contenido del sitio en **español** (es-ES). Código e identificadores en inglés.

## Comandos

```bash
bun dev        # dev server
bun run build  # build estático (SIEMPRE verificar antes de terminar una tarea)
bun run preview
```

No hay linter configurado. Verificación mínima: `bun run build` debe pasar sin errores.

---

## Sistema de diseño Once UI

### Cómo funciona el theming

- Los tokens viven en `src/styles/global.css` como CSS variables con nombres **idénticos** a los del paquete oficial Once UI.
- El tema se controla con atributos en `<html>`: `data-theme="light|dark"` (seteado por un script inline en `src/layouts/BaseLayout.astro` ANTES del primer paint para evitar FOUC), más `data-neutral="gray"`, `data-accent="custom"`, `data-border="playful"`, `data-surface="translucent"`.
- La marca tiene un único color identitario (dorado `#deb574`): `brand` y `accent` están aliasados al mismo scheme.

### Capas de tokens (en orden de uso)

1. **Semánticos** (los que se usan en componentes): `--page-background`, `--surface-background`, `--neutral-background-weak|medium|strong`, `--neutral-on-background-weak|medium|strong`, `--neutral-border-weak|medium|strong`, `--neutral-alpha-weak|medium|strong` y el mismo set para `--accent-*`.
2. **Función**: `--function-neutral-100..1200`, `--function-accent-100..1200` (+ alfas `-600-15/30/50`).
3. **Scheme**: `--scheme-neutral-*`, `--scheme-accent-*` (rampas oklch). No usar directamente en componentes.
4. **Espaciado**: `--static-space-0..160` (escala 1,2,4,8,12,16,20,24,32,40,48,56,64,80,128,160).
5. **Radius** (playful): `--radius-xs|s|m|l|xl|full` = 0.25/0.5/0.75/1/1.25rem/999rem.
6. **Sombras**: `--shadow-xs|s|m|l|xl`.
7. **Tipografía**: `--font-heading|body|label|code` (Geist Variable / Geist Mono Variable), tamaños `--font-size-{display,heading,body,label}-{xl,l,m,s,xs}` con sus `--line-height-*` y pesos `--font-weight-*` (display default light 300; heading default 400, strong 600; label default 400, strong 600).
8. **Transiciones**: `--transition-micro-short|medium|long` (0.1s/0.2s/0.4s ease-in-out). Nada de animaciones largas.

### Tailwind mapping (usar ESTOS nombres de utilidad)

`@theme inline` mapea los tokens 1:1. Los nombres de las utilidades reproducen los nombres de los tokens de Once UI:

| Tokens (CSS var)                          | Utilidades Tailwind                              |
| ----------------------------------------- | ------------------------------------------------ |
| `--page-background`                       | `bg-page`                                        |
| `--surface-background`                    | `bg-surface`                                     |
| `--neutral-background-weak/medium/strong` | `bg-neutral-background-weak` etc.                |
| `--neutral-on-background-strong/…`        | `text-neutral-on-background-strong` etc.         |
| `--neutral-border-weak/…`                 | `border-neutral-border-weak` etc.                |
| `--neutral-alpha-weak/…`                  | `bg-neutral-alpha-weak` (también `border-…`)     |
| `--accent-background-*`, `--accent-solid-*`, `--accent-on-solid-*`, `--accent-on-background-*`, `--accent-border-*`, `--accent-alpha-*` | `bg-accent-solid-strong`, `text-accent-on-solid-strong`, `bg-accent-alpha-weak`, `text-accent-on-background-weak`, etc. |
| `--font-heading/body/label/code`          | `font-heading`, `font-body`, `font-label`, `font-code` |
| `--font-size-display-*`                   | `text-display-xl/l/m/s/xs` (con line-height incluido) |
| `--font-size-heading-*`                   | `text-heading-xl/l/m/s/xs`                       |
| `--font-size-body-*`                      | `text-body-l/m/s/xs`                             |
| `--font-size-label-*`                     | `text-label-l/m/s/xs`                            |
| `--radius-*`                              | `rounded-xs/s/m/l/xl/full`                       |
| `--shadow-*`                              | `shadow-xs/s/m/l/xl`                             |

Modo oscuro: casi nunca hace falta la variante `dark:` porque los tokens cambian solos con `data-theme`. Solo usarla para detalles (ej. mostrar/ocultar iconos sol/luna).

### Recetas de componentes Once UI

- **Página/layout**: `BaseLayout.astro` es el único lugar con `<html>`. Toda página nueva lo usa.
- **Contenedor**: `mx-auto max-w-6xl px-4 sm:px-6` (o `max-w-3xl` para artículos).
- **Card**: `rounded-l border border-neutral-alpha-weak bg-neutral-background-weak` + hover `hover:border-neutral-border-medium` con `transition-colors duration-100`.
- **Botón primario**: `rounded-full bg-accent-solid-strong text-accent-on-solid-strong hover:bg-accent-solid-medium text-label-m font-medium px-5 py-2.5`.
- **Botón secundario**: `rounded-full border border-neutral-alpha-strong text-neutral-on-background-strong hover:bg-neutral-alpha-weak`.
- **Chip/etiqueta**: `rounded-full bg-accent-alpha-weak px-3 py-1 text-label-s text-accent-on-background-weak`.
- **Título display**: `font-heading text-display-{s..xl} font-light text-neutral-on-background-strong`.
- **Eyebrow**: `text-label-s text-accent-on-background-weak`.
- **Texto cuerpo**: `text-body-m text-neutral-on-background-medium`; secundario `text-body-s text-neutral-on-background-weak`.
- **Iconos**: componente `src/components/Icon.astro` con SVG inline. PROHIBIDO añadir librerías de iconos (fontawesome, lucide-react, etc.).
- **Fecha**: `FormattedDate.astro` (locale es-ES).

### Prohibido en el diseño

- Colores hex/oklch crudos en componentes o clases arbitrarias tipo `bg-[#...]`, `text-[12px]`, `rounded-[3px]`.
- Importar frameworks CSS/UI adicionales (no React, no Vue, no shadcn, no MUI…).
- Sombras/coloridos exagerados, gradientes decorativos, glassmorphism más allá del header sticky.
- `!important` salvo el bloque `prefers-reduced-motion` existente.

---

## Performance (EXTREMADAMENTE IMPORTANTE)

Reglas por orden de impacto:

1. **Cero JS de frameworks**: no React/Preact/Vue/Svelte islands. El único JS es vanilla en `<script>` de Astro (bundled + deferred) y el script inline anti-FOUC en `BaseLayout.astro`.
2. **Iconos SVG inline** via `Icon.astro` — nunca webfonts de iconos ni paquetes npm de iconos.
3. **Fuentes**: solo Geist Variable + Geist Mono Variable self-hosted via `@fontsource-variable/*` (con `unicode-range` el browser solo baja el subset latin). No añadir más familias/pesos ni Google Fonts.
4. **Imágenes**: siempre `<Image>` de `astro:assets` con `width`/`height` explícitos (evita CLS). Hero de post: `loading="eager" fetchpriority="high"`; resto `loading="lazy"`. Formato final webp automático.
5. **CSS**: un único `global.css` importado desde `BaseHead.astro`. Evitar CSS duplicado; estilos de artículo en `.article-body` (no usar plugin de tipografía).
6. **Animaciones**: solo `transform`/`opacity`, duraciones `--transition-micro-*`, y respetar `prefers-reduced-motion`.
7. **Mapas**: SVG propio generado en build (`scripts/generate-map-data.ts`, datos Natural Earth + OSRM committeados en `src/data/map-data.json`), estilizado con tokens Once UI; los países activos se derivan del campo `country` del frontmatter de los artículos (`src/content/blog/*.md`): un país aparece en el mapa solo cuando existe al menos una historia con ese país. `MANUAL_MAP_COUNTRIES` en `src/data/route.ts` permite forzar países a mano. Nunca librerías de mapas en runtime (Leaflet, Mapbox…), nunca iframes ni tiles externos; los pins son links SVG y el toggle de capas es CSS puro; atribución OSM en el caption.
8. **Astro config**: mantener `output` estático por defecto, sitemap + RSS activos. No añadir SSR/adaptadores salvo necesidad real.
9. Presupuesto objetivo: cada página debe seguir construyéndose sin JS en caliente y con HTML+CSS mínimos. Si una feature exige mucho JS, proponer alternativa estática primero.

---

## Contenido (src/content/blog)

- Colección `blog` (`.md`/`.mdx`) con schema en `src/content.config.ts`: `title`, `description`, `pubDate`, `updatedDate?`, `heroImage?` (imagen relativa a `src/assets/`).
- Frontmatter en español, títulos concisos, `description` de 1–2 frases (se usa en meta tags y cards).
- `src/consts.ts` es la fuente única de: `SITE_TITLE`, `SITE_DESCRIPTION`, `NAV_LINKS`, `SOCIAL_LINKS`.

## Estructura

```
src/
  components/   # Icon, Header, Footer, HeaderLink, FormattedDate, BaseHead
  layouts/      # BaseLayout (html/head/body), BlogPost (artículo)
  pages/        # index, about, blog/index, blog/[...slug], rss.xml.js
  content/blog/ # artículos md/mdx
  styles/       # global.css (tokens Once UI + base + article-body)
  consts.ts     # datos globales del sitio
  assets/       # imágenes de artículos
```
