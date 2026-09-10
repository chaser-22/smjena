import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const productionUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

const title = 'SMJENA — Kad fali jedan.';
const description =
  'Hitne ugostiteljske smjene u Crnoj Gori. Objavi potrebu ili uzmi dostupnu smjenu bez oglasa i CV-a.';

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title,
  description,
  applicationName: 'SMJENA',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  appleWebApp: {
    capable: true,
    title: 'SMJENA',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title,
    description,
    locale: 'sr_ME',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/opengraph-image'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101d34',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sr-Latn-ME">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Preskoči na glavni sadržaj
        </a>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
