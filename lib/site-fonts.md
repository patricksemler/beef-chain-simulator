# `lib/site-fonts.ts` — fonts for the public pages

**Role:** Loads IBM Plex Serif (`--font-display`) and IBM Plex Mono (`--font-data`) through `next/font/google`, and exports `siteFontClassName`, which sets both CSS variables.

## Why it exists

The home page (`/`) and market trends page (`/trends`) use a serif/mono look. The simulator uses Inter from `app/layout.tsx`. Keeping these fonts in their own module means only the public pages load them, so the simulator doesn't download unused fonts.

## Where it fits

- **Imported by:** `app/page.tsx` and `app/trends/page.tsx`, which put `siteFontClassName` on their root element.
- **CSS:** `app/globals.css` reads `var(--font-display)` and `var(--font-data)`.
- The fonts are fetched at build time by `vinext`'s `next/font` support, and the site is a static export.

## Testing

There's no automated test. To check it:
1. Run `npm run build`, which fails if a font can't be resolved.
2. Run `npm run dev` and open `/` and `/trends`.
3. Confirm headings use IBM Plex Serif and numbers use IBM Plex Mono (computed `font-family`), and that `/simulator` still uses Inter.

## When changing this file

If you rename a CSS variable, update `app/globals.css` too. Each extra weight adds a font file to the public pages.
