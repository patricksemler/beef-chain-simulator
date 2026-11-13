import { Caveat, IBM_Plex_Mono, Oswald, Zilla_Slab } from 'next/font/google';

/**
 * Faces for the Aggie look, applied on each page's root:
 * - display: a warm slab serif for headlines, like a ranch-sale poster.
 * - eyebrow: a condensed athletic sans for small uppercase labels.
 * - hand: handwriting for notes scribbled onto charts and illustrations.
 * - data: a monospaced face for figures.
 */
const displayFont = Zilla_Slab({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const eyebrowFont = Oswald({
  variable: '--font-eyebrow',
  subsets: ['latin'],
  weight: ['500', '600'],
});

const handFont = Caveat({
  variable: '--font-hand',
  subsets: ['latin'],
  weight: ['500', '700'],
});

const dataFont = IBM_Plex_Mono({
  variable: '--font-data',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const siteFontClassName = `${displayFont.variable} ${eyebrowFont.variable} ${handFont.variable} ${dataFont.variable}`;
