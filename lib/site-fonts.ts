import { IBM_Plex_Mono, IBM_Plex_Serif } from 'next/font/google';

/**
 * Faces for the public pages only. They are applied on each page's root so the
 * simulator, which uses the app's default sans, does not load them.
 */
const displayFont = IBM_Plex_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500'],
});

const dataFont = IBM_Plex_Mono({
  variable: '--font-data',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const siteFontClassName = `${displayFont.variable} ${dataFont.variable}`;
