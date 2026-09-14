import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MarketplaceShell } from '@/components/marketplace/shell';
import styles from '@/components/marketplace/marketplace.module.css';
import { getPublicShifts, publicShiftTime } from '@/lib/public-shifts';

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
    <div className={styles.panel}><span className={styles.pay}>€{(shift.pay_cents / 100).toFixed(2)}</span><p>Ponuđena naknada po osobi za cijelu smjenu.</p>
      <dl className={styles.detail}><div><dt>Početak</dt><dd>{publicShiftTime(shift.starts_at)}</dd></div><div><dt>Kraj</dt><dd>{publicShiftTime(shift.ends_at)}</dd></div><div><dt>Dio grada</dt><dd>{shift.location_area}, {shift.city}</dd></div><div><dt>Broj mjesta u oglasu</dt><dd>{shift.workers_needed}</dd></div></dl>
      <h2>Uslovi</h2>{shift.requirements.length ? <ul className="list-disc space-y-2 pl-5">{shift.requirements.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>Poslodavac nije naveo dodatne uslove.</p>}
    </div>
    <aside className={styles.notice}><h2>Prijave još nijesu otvorene</h2><p>Javni pregled je pripremljen. Prijavljivanje će biti dostupno kada poslodavac bude mogao da pregleda prijave i pošalje ponudu, a radnik da je prihvati ili odbije.</p><p className="mt-3">Pregled oglasa ne rezerviše mjesto. Privatni kontakt nije dostupan prije prihvatanja ponude.</p></aside>
  </MarketplaceShell>;
}
