import { Zilla_Slab } from 'next/font/google';

/**
 * The display face, applied on each page's root: a warm slab serif for the
 * brand and headings. Everything else, figures included, is set in Inter
 * (from the root layout) with tabular numerals, so the site uses two faces.
 */
const displayFont = Zilla_Slab({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700'],
});

export const siteFontClassName = displayFont.variable;
