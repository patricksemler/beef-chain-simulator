# `lib/site-fonts.ts` — the display face

**Role:** Loads Zilla Slab through `next/font/google` and exports `siteFontClassName`, which sets `--font-display`.

| Variable | Face | Used for |
| --- | --- | --- |
| `--font-display` | Zilla Slab | The brand, page and section headings, panel titles, the simulator's headline number |

Everything else, including every figure, is Inter (from `app/layout.tsx`) with tabular numerals. Two faces keep the public pages and the simulator reading as one site.

## Where it fits

- **Imported by:** `app/page.tsx`, `app/trends/page.tsx`, and `app/simulator/page.tsx`. The first two put `siteFontClassName` on their root element. The simulator wraps its page in a `display: contents` div that carries the class.
- **CSS:** `app/globals.css` reads `--font-display`.
- The font is fetched at build time by `vinext`'s `next/font` support, and the site is a static export.

## Testing

There's no automated test. To check it:
1. Run `npm run build`, which fails if a font can't be resolved.
2. Run `npm run dev` and open `/`, `/trends`, and `/simulator`.
3. Confirm headings use Zilla Slab and everything else uses Inter (computed `font-family`).

## When changing this file

If you rename the CSS variable, update `app/globals.css` too. Each extra weight adds a font file to every page.
