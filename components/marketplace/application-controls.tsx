'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applicationAction, publishApplicationAction } from '@/app/applications/actions';
import { updateContactAction } from '@/app/dashboard/actions';
import { jobRoles, jobRequirements, locationAreas, type MarketplaceResult } from '@/lib/applications';
import styles from './marketplace.module.css';

function Feedback({ state }: { state: MarketplaceResult }) {
  return <>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.message && <div className={styles.success} aria-live="polite"><p>{state.message}</p>{state.href && <Link className={styles.button} href={state.href}>Nastavi →</Link>}</div>}</>;
}
const disconnected: MarketplaceResult = { error: 'Veza je prekinuta. Ishod nije potvrđen. Osvježi status prije novog pokušaja.' };

export function ApplicationControl({ id, decision, label, confirmation }: { id: string; decision: string; label: string; confirmation?: string }) {
  const [state, action, pending] = useActionState(async (previous: MarketplaceResult, data: FormData) => {
    try { return await applicationAction(previous, data); } catch { return disconnected; }
  }, {});
  return <form action={action} className={styles.control}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value={decision} />
    {confirmation && <label className={styles.check}><input name="confirmed" type="checkbox" required disabled={pending} />{confirmation}</label>}
    <button className={styles.button} disabled={pending}>{pending ? 'Provjeravam i čuvam…' : label}</button>
    <Feedback state={state} />
  </form>;
}

export function RefreshApplications() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 20000);
    return () => clearInterval(timer);
  }, [router]);
  return <button className={styles.secondary} onClick={() => router.refresh()}>Osvježi status</button>;
}

export function ApplicationPhoneForm({ phone, workspace }: { phone: string | null; workspace?: string }) {
  const [value, setValue] = useState(phone ?? '');
  const [state, action, pending] = useActionState(async (): Promise<MarketplaceResult> => {
    try {
      const result = await updateContactAction(value, workspace ? { role: 'employer', employerId: workspace } : { role: 'worker' });
      return result.ok ? { message: 'Kontakt je sačuvan. Nije javan.' } : { error: result.error };
    } catch { return disconnected; }
  }, {});
  return <details><summary className={styles.secondary}>{phone ? 'Uredi privatni kontakt' : 'Dodaj privatni kontakt telefon'}</summary><form action={action} className={styles.form}>
    <label>Kontakt telefon<input value={value} onChange={(event) => setValue(event.target.value)} type="tel" autoComplete="tel" placeholder="067 123 456" required disabled={pending} /></label>
    <p>Kontakt se otkriva drugoj strani tek nakon prihvatanja ponude.</p>
    <button className={styles.button} disabled={pending}>{pending ? 'Čuvam…' : 'Sačuvaj kontakt'}</button><Feedback state={state} />
  </form></details>;
}

export function PublishApplicationForm({ workspace, businessName, requestId }: { workspace: string; businessName: string; requestId: string }) {
  const [stableRequestId] = useState(requestId);
  const [values, setValues] = useState({ publicName: businessName, role: 'Konobar', area: 'Centar', address: '', start: '', end: '', compensation: '80', places: '1' });
  const [requirements, setRequirements] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(async (previous: MarketplaceResult, data: FormData) => {
    try { return await publishApplicationAction(previous, data); } catch { return disconnected; }
  }, {});
  const change = (key: keyof typeof values, value: string) => setValues((previous) => ({ ...previous, [key]: value }));
  if (state.href) return <Feedback state={state} />;
  return <form action={action} className={styles.form}>
    <input type="hidden" name="workspace" value={workspace} /><input type="hidden" name="requestId" value={stableRequestId} />
    <label>Javni naziv lokala<input name="publicName" value={values.publicName} onChange={(e) => change('publicName', e.target.value)} minLength={2} maxLength={120} required disabled={pending} /></label>
    <p>Naziv će biti vidljiv svima. Bez telefona, emaila i privatnih podataka.</p>
    <div className={styles.grid}><label>Potreban radnik<select name="role" value={values.role} onChange={(e) => change('role', e.target.value)} disabled={pending}>{jobRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label>Broj mjesta<input name="places" type="number" min={1} max={50} required value={values.places} onChange={(e) => change('places', e.target.value)} disabled={pending} /></label></div>
    <div className={styles.grid}>{(['start', 'end'] as const).map((key) => <label key={key}>{key === 'start' ? 'Početak' : 'Završetak'} — vrijeme u Crnoj Gori<input type="datetime-local" name={key} required value={values[key]} onChange={(e) => change(key, e.target.value)} disabled={pending} /></label>)}</div>
    <label>Ponuđeno po osobi za cijelu smjenu (€)<input name="compensation" type="number" min={20} max={5000} step="0.01" required value={values.compensation} onChange={(e) => change('compensation', e.target.value)} disabled={pending} /></label>
    <label>Javni dio grada<select name="area" value={values.area} onChange={(e) => change('area', e.target.value)} disabled={pending}>{locationAreas.map((area) => <option key={area}>{area}</option>)}</select></label>
    <label>Privatna tačna adresa<input name="address" required minLength={2} maxLength={200} value={values.address} onChange={(e) => change('address', e.target.value)} disabled={pending} /></label>
    <p>Tačnu adresu vidi samo radnik koji prihvati ponudu.</p>
    <details><summary className={styles.secondary}>Dodaj uslove (opciono)</summary>{jobRequirements.map((item) => <label className={styles.check} key={item}><input type="checkbox" name="requirements" value={item} checked={requirements.includes(item)} onChange={(e) => setRequirements((previous) => e.target.checked ? [...previous, item] : previous.filter((value) => value !== item))} disabled={pending} />{item}</label>)}</details>
    <label className={styles.check}><input name="confirmed" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required disabled={pending} />Potvrđujem javni naziv i uslove. Firma bira radnika i odgovorna je za zakonit osnov angažovanja i plaćanje.</label>
    <button className={styles.button} disabled={pending}>{pending ? 'Objavljujem…' : 'Objavi oglas za smjenu'}</button><Feedback state={state} />
  </form>;
}
