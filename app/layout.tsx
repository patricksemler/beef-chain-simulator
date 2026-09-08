import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Beef Chain Simulator',
  description: 'Explore U.S. beef supply chain economics from cow-calf through packer and retail.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The font variable must land on <html>: `--font-sans` is declared at :root,
  // so a variable defined only on <body> resolves as invalid there.
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
