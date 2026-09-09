import Link from 'next/link';
import { Zap } from 'lucide-react';
import styles from './public.module.css';

export function PublicBrand() {
  return (
    <Link href="/" className={styles.brand} aria-label="SMJENA — početna">
      <span>
        <Zap size={22} fill="currentColor" aria-hidden="true" />
      </span>
      SMJENA<span className={styles.brandPeriod}>.</span>
    </Link>
  );
}
