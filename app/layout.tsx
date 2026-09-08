import type { Metadata } from 'next';
import { Manrope, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });
const sourceSans = Source_Sans_3({ variable: '--font-source-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Beef Chain Simulator',
  description: 'Explore U.S. beef supply chain economics from cow-calf through packer and retail.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${manrope.variable} ${sourceSans.variable} antialiased`}>{children}</body></html>;
}
