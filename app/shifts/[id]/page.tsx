import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MarketplaceShell } from '@/components/marketplace/shell';
import styles from '@/components/marketplace/marketplace.module.css';
import { getPublicShifts, publicShiftTime } from '@/lib/public-shifts';
import { ApplicationEntry } from '@/components/marketplace/application-entry';
import { EmployerResponsibility } from '@/components/marketplace/responsibility';
import { RefreshApplications } from '@/components/marketplace/application-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalji smjene | SMJENA' };

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await getPublicShifts(undefined, id);
  if (result.unavailable) throw new Error('Public listings unavailable');
  const shift = result.shifts[0];
  if (!shift) notFound();
  return <MarketplaceShell><Link className="inline-flex min-h-11 items-center underline" href="/shifts">← Sve smjene</Link>
    <p className={styles.kicker}>{shift.employer_name} · {shift.city}</p><h1>{shift.role}</h1>
    {shift.is_sos && <><p className={styles.notice}>SOS · Promovisan oglas. Oznaka nije potvrda provjere firme niti garancija angažovanja.</p><RefreshApplications /></>}
    <div className={styles.panel}><span className={styles.pay}>€{(shift.pay_cents / 100).toFixed(2)}</span><p>Ponuđena naknada po osobi za cijelu smjenu.</p>
      <dl className={styles.detail}><div><dt>Početak</dt><dd>{publicShiftTime(shift.starts_at)}</dd></div><div><dt>Kraj</dt><dd>{publicShiftTime(shift.ends_at)}</dd></div><div><dt>Dio grada</dt><dd>{shift.location_area}, {shift.city}</dd></div><div><dt>Broj mjesta u oglasu</dt><dd>{shift.workers_needed}</dd></div></dl>
      <h2>Uslovi</h2>{shift.requirements.length ? <ul className="list-disc space-y-2 pl-5">{shift.requirements.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>Poslodavac nije naveo dodatne uslove.</p>}
    </div>
    <aside className={styles.notice}><h2>Prijavi se bez CV-a</h2><p>Prijava je besplatna i ne rezerviše mjesto. Poslodavac bira kome šalje ponudu. Kontakt se otkriva tek kada prihvatiš ponudu.</p>
      <ApplicationEntry shiftId={id} />
    </aside><EmployerResponsibility />
  </MarketplaceShell>;
}
