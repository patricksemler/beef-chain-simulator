# `lib/site-fonts.ts` — fonts for the Aggie look

**Role:** Loads four faces through `next/font/google` and exports `siteFontClassName`, which sets their CSS variables:

| Variable | Face | Used for |
| --- | --- | --- |
| `--font-display` | Zilla Slab | Headlines, panel titles, the simulator's headline number |
| `--font-eyebrow` | Oswald | Small uppercase labels: brand, stage names, primary buttons |
| `--font-hand` | Caveat | The handwritten note on the trends chart and the circled step numbers |
| `--font-data` | IBM Plex Mono | Prices and other figures on the public pages |

## Why it exists

The site uses a Texas A&M (Aggie) look: maroon bands, a slab serif, and hand-drawn touches. Body text stays Inter, from `app/layout.tsx`. Keeping these faces in one module means every page loads the same set.

## Where it fits

- **Imported by:** `app/page.tsx`, `app/trends/page.tsx`, and `app/simulator/page.tsx`. The first two put `siteFontClassName` on their root element. The simulator wraps its page in a `display: contents` div that carries the class.
- **CSS:** `app/globals.css` reads the four variables.
- The fonts are fetched at build time by `vinext`'s `next/font` support, and the site is a static export.

## Testing

There's no automated test. To check it:
1. Run `npm run build`, which fails if a font can't be resolved.
2. Run `npm run dev` and open `/`, `/trends`, and `/simulator`.
3. Confirm headings use Zilla Slab, the header brand uses Oswald, the trends chart note uses Caveat, and numbers on the public pages use IBM Plex Mono (computed `font-family`).

## When changing this file

If you rename a CSS variable, update `app/globals.css` too. Each extra weight adds a font file to every page.
