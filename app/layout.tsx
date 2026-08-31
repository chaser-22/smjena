import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3001'),
  title: 'SMJENA — Radi danas. Zaradi danas.',
  description: 'Hitne smjene u ugostiteljstvu. Pronađi radnika ili uzmi smjenu u nekoliko minuta.',
  openGraph: {
    title: 'SMJENA — Radi danas. Zaradi danas.',
    description: 'Hitne smjene u ugostiteljstvu. Pronađi radnika ili uzmi smjenu u nekoliko minuta.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'SMJENA — Radi danas. Zaradi danas.' }],
    locale: 'hr_HR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SMJENA — Radi danas. Zaradi danas.',
    description: 'Hitne smjene u ugostiteljstvu. Pronađi radnika ili uzmi smjenu u nekoliko minuta.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
