'use client';
import { useActionState, useState } from 'react';
import { activateSosAction } from '@/app/employer/billing/actions';
import type { MarketplaceResult } from '@/lib/applications';
import styles from './marketplace.module.css';

export type SosCredit = { id: string; remaining_units: number; sos_duration_minutes: number; expires_at: string };
export function SosForm({ shift, credits, requestId }: { shift: string; credits: SosCredit[]; requestId: string }) {
  const [request] = useState(requestId);
  const [selected, setSelected] = useState(credits[0]?.id ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const credit = credits.find((item) => item.id === selected);
  const [state, action, pending] = useActionState(async (previous: MarketplaceResult, form: FormData) => {
    try { return await activateSosAction(previous, form); }
    catch { return { error: 'Veza je prekinuta. Osvježi stanje; ponovni pokušaj sa iste forme ne troši drugi kredit.' }; }
  }, {});
  if (state.message) return <p className={styles.success} aria-live="polite">{state.message}</p>;
  return <form className={styles.form} action={action}>
    <input type="hidden" name="shift" value={shift} /><input type="hidden" name="request" value={request} />
    <input type="hidden" name="minutes" value={credit?.sos_duration_minutes ?? ''} />
    <label>SOS kredit<select name="grant" value={selected} onChange={(event) => { setSelected(event.target.value); setConfirmed(false); }} disabled={pending} required>
      {credits.map((item) => <option value={item.id} key={item.id}>{item.sos_duration_minutes} min · {item.remaining_units} preostalo</option>)}
    </select></label>
    <label className={styles.check}><input name="confirmed" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} required />
      Koristim 1 SOS kredit za {credit?.sos_duration_minutes ?? '—'} minuta isticanja. Ovo ne garantuje prijave i ne povećava naknadu radniku.</label>
    <button className={styles.button} disabled={pending || !credit}>{pending ? 'Aktiviram…' : 'Aktiviraj SOS — 1 kredit'}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
  </form>;
}
