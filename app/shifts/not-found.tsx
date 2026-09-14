import Link from 'next/link';
import { MarketplaceShell } from '@/components/marketplace/shell';
import styles from '@/components/marketplace/marketplace.module.css';
export default function NotFound() { return <MarketplaceShell><h1>Oglas nije dostupan.</h1><p>Možda je zatvoren, istekao ili nije namijenjen javnom pregledu.</p><Link className={styles.button} href="/shifts">Pogledaj druge smjene</Link></MarketplaceShell>; }
