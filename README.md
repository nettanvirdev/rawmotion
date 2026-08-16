# Raw Motion

An AI platform for generating motion graphics and product launch videos.
Desktop app built on Electron 43 + React 19 + Vite 8 + Tailwind 4.

> **Status: foundation.** The design system, app shell and packaging pipeline
> are in place. There is no generation pipeline yet.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Vite serves the renderer on `:5173` and Electron attaches to it with HMR.

## Scripts

| Script            | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `npm run dev`     | Vite dev server + Electron, concurrently                          |
| `npm run build`   | Build the renderer into `dist/`                                   |
| `npm test`        | Run the Vitest suite once                                         |
| `npm run logo`    | Rasterize `public/assets/logo.svg` into the PNG logos             |
| `npm run icons`   | Run `logo`, then regenerate `build/icon.ico` and the NSIS bitmaps |
| `npm run pack`    | Unpacked build, for smoke-testing packaging                       |
| `npm run release` | Windows installer + portable exe into `release/`                  |

Release output:

- `Raw Motion-Setup-<version>.exe` - installer with a custom Additional Tasks page
- `Raw Motion-<version>-portable.exe` - no-install portable build

## Layout

```
src/
  main/                  Electron main process + preload bridge
  renderer/
    components/
      layout/            Titlebar, Sidebar, Header
      ui/                Design-system primitives
    lib/                 cn(), theme store
    styles/globals.css   Design tokens - the source of truth
scripts/                 Packaging asset generation
build/                   NSIS resources (icon + bitmaps are generated)
```

## Branding

`public/assets/logo.svg` is the single source for the app mark - a violet
squircle plate, a frosted-glass video frame, and a solid white play glyph.
Edit the SVG and run `npm run icons`; never hand-edit the PNGs, `.ico` or
BMPs, since they are all generated from it.

The `.ico` entries at 32px and below are cropped to the plate bounds so the
glyph survives at taskbar and title-bar sizes - see `CROP_AT_OR_BELOW` in
`scripts/generate-icons.mjs`.

## Design system

Everything visual is driven by `src/renderer/styles/globals.css`. Read that
file before adding UI - it is the spec, not just a stylesheet.

**Theming.** Class-based on `<html>`: `dark`, plus additive `oled` and
`high-contrast`. Light is the structural default; the app boots into dark via
an inline pre-paint guard in `index.html` (keep it there - moving it causes a
flash). State persists to `localStorage` under the `rawmotion.*` keys.

**The rules that carry the look:**

- One neutral ramp, authored in OKLCH so the steps are perceptually even. It
  includes a non-standard `850` step - that is the dark-mode surface, and
  `800`/`900` cannot cover for it.
- Two font weights, 400 and 500. No 600/700 anywhere in UI chrome.
- Chrome is 13px, body is 15px, controls are 14px.
- Surfaces _shift_ between themes (gray-50 → gray-850); the primary action
  _inverts_ (black-on-white → white-on-black). It is never a hue.
- **No borders.** No border, outline, rule, divider or hairline on any
  surface, in any state — including a `0 0 0 1px` spread shadow, which is a
  border in disguise. Separation comes from surface contrast, shadow and
  spacing. The one exception is the `focus-visible` ring, which stays because
  removing it makes the app unusable by keyboard.
- Because there are no borders, in-flow surfaces use `bg-surface-sunken`, not
  `bg-surface` — the latter is `#ffffff` in light mode, identical to the
  canvas, so a card using it would be invisible. `bg-surface` is for floating
  layers that also carry a shadow.
- Shadows are heavier than a bordered system needs, for the same reason.
  Verify **light** mode first; dark mode hides this failure entirely.
- Near-zero hue. Color appears only as status tints - 20% fill with 700/200
  text is the single status recipe.
- Nothing animates longer than 300ms. No bounce, no spring.
- There is no red button. Destructive intent is carried by a confirm dialog.
- Spinners and text for loading - never skeleton bars. Don't mix the two.

**Accessibility is a requirement here, not a nicety.** Every interactive
element gets a visible `focus-visible` ring, `prefers-reduced-motion` is
honored, and the muted palette (gray-400/500) fails contrast for body text -
use it only for genuinely secondary information. `high-contrast` raises it.

Utility naming maps to roles rather than raw colors: `bg-canvas`,
`bg-surface-sunken`, `text-ink-muted`, `bg-wash-ghost`, `bg-row-selected`,
`bg-action`/`text-action-fg`. Radii use the design vocabulary directly
(`rounded-sm` = 6px … `rounded-3xl` = 32px), and type sizes are named in px
(`text-13`, `text-15`).

> **If you add a size to the px type scale, add it to `FONT_SIZES` in
> [lib/utils.js](src/renderer/lib/utils.js) too.** `tailwind-merge` can't tell
> `text-14` from a color, so an unregistered size silently deletes whatever
> text color it's paired with — that shipped once as a white-on-white button
> and 16px sidebar chrome. `utils.test.js` guards the registered sizes.

## Security

Context isolation on, `nodeIntegration` off, sandboxed renderer, a CSP on the
document, a single-instance lock, and a whitelisted `http(s)`-only external
link opener. The renderer reaches the main process only through the narrow
`window.electronAPI` surface in `src/main/preload.cjs`.

## License

CC0-1.0.
