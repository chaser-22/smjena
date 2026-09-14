'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createWorkspaceAction, enableWorkerAction, type SettingsResult } from '@/app/settings/actions';
import { dashboardHref } from '@/lib/account-context';
import { montenegroCities } from '@/lib/montenegro';
import styles from './marketplace.module.css';

const disconnected: SettingsResult = { error: 'Veza je prekinuta. Akcija nije potvrđena. Pokušaj ponovo.' };

export function EnableWorkerForm() {
  const [state, action, pending] = useActionState(async (): Promise<SettingsResult> => {
    try { return await enableWorkerAction(); } catch { return disconnected; }
  }, {});
  if (state.success) return <p className={styles.success} aria-live="polite">Radnički profil je dodat. <Link href="/dashboard?mode=worker">Otvori profil</Link></p>;
  return <form action={action}>
    <button className={styles.button} disabled={pending}>{pending ? 'Dodajem profil…' : 'Dodaj radnički profil'}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
  </form>;
}

export function CreateWorkspaceForm({ city, requestId }: { city: string; requestId: string }) {
  const [stableRequestId] = useState(requestId);
  const [name, setName] = useState('');
  const [selectedCity, setCity] = useState(city);
  const [state, action, pending] = useActionState(async (previous: SettingsResult, data: FormData): Promise<SettingsResult> => {
    try { return await createWorkspaceAction(previous, data); } catch { return disconnected; }
  }, {});
  if (state.success && state.workspaceId) return <div className={styles.success} aria-live="polite">
    <p>Firma je dodata na tvoj nalog.</p>
    <Link className={styles.button} href={dashboardHref({ role: 'employer', employerId: state.workspaceId })}>Otvori firmu</Link>
  </div>;
  return <form action={action} className={styles.form}>
    <input type="hidden" name="requestId" value={stableRequestId} />
    <label>Naziv firme ili lokala<input name="name" autoComplete="organization" minLength={2} maxLength={120} required disabled={pending} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Grad<select name="city" value={selectedCity} onChange={(event) => setCity(event.target.value)} required disabled={pending}>{montenegroCities.map((item) => <option key={item}>{item}</option>)}</select></label>
    <button className={styles.button} disabled={pending}>{pending ? 'Dodajem firmu…' : 'Dodaj firmu'}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
  </form>;
}
