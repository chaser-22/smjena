'use client';

import { useActionState } from 'react';
import { preferredAction } from '@/app/applications/preferred-actions';
import type { MarketplaceResult } from '@/lib/applications';
import styles from './marketplace.module.css';

export function PreferredControl({ action: decision, id, worker, label }: {
  action: 'invite' | 'dismiss' | 'save' | 'remove' | 'allow' | 'mute'; id: string; worker?: string; label: string;
}) {
  const [state, action, pending] = useActionState(async (previous: MarketplaceResult, form: FormData) => {
    try { return await preferredAction(previous, form); }
    catch { return { error: 'Veza je prekinuta. Osvježi status prije novog pokušaja.' }; }
  }, {});
  return <form action={action} className={styles.control}>
    <input type="hidden" name="action" value={decision} /><input type="hidden" name="id" value={id} />
    {worker && <input type="hidden" name="worker" value={worker} />}
    <button className={styles.secondary} disabled={pending}>{pending ? 'Čuvam…' : label}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p aria-live="polite" className={styles.success}>{state.message}</p>}
  </form>;
}
