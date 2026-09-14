import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicBrand } from '@/components/marketing/public-brand';
import styles from './marketplace.module.css';

export function MarketplaceShell({ children }: { children: ReactNode }) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <PublicBrand />
      <nav aria-label="Navigacija"><Link href="/shifts">Smjene</Link><Link href="/applications">Prijave</Link><Link href="/settings">Moj nalog</Link></nav>
    </header>
    <main id="main-content" className={styles.main}>{children}</main>
    <footer className={styles.footer}>SMJENA · Ugostiteljstvo u Crnoj Gori.</footer>
  </div>;
}
