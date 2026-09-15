import Link from 'next/link';
import { MarketplaceShell } from '@/components/marketplace/shell';
import styles from '@/components/marketplace/marketplace.module.css';
import { getPublicShifts, publicShiftTime } from '@/lib/public-shifts';
import { montenegroCities } from '@/lib/montenegro';
import { RefreshApplications } from '@/components/marketplace/application-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Smjene u Crnoj Gori | SMJENA' };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const params = await searchParams;
  const city = montenegroCities.find((item) => item === params.city);
  const result = await getPublicShifts(city);
  return <MarketplaceShell>
    <p className={styles.kicker}>Kratke smjene. Jasni uslovi.</p><h1>Pronađi svoju<br />sljedeću smjenu.</h1>
    <p className={styles.intro}>Pregledaj oglase bez prijave na nalog. Vidiš ponuđenu naknadu, vrijeme i dio grada — privatni kontakti i tačna adresa nijesu javni.</p>
    <form className={styles.filters} action="/shifts"><label>Grad<select name="city" defaultValue={city ?? ''}><option value="">Svi gradovi</option>{montenegroCities.map((item) => <option key={item}>{item}</option>)}</select></label><button className={styles.button}>Prikaži smjene</button></form>
    {!result.unavailable && result.shifts.length > 0 && <><p>SOS označava promovisani oglas, ne provjeru firme. Promovisani oglasi se prikazuju prvi; ostali su poređani po početku smjene.</p><RefreshApplications /></>}
    {result.unavailable ? <section className={styles.notice}><h2>Oglasi trenutno nijesu dostupni</h2><p>Pokušaj ponovo kasnije. Postojeće smjene na tvom nalogu ostaju u radničkom ili poslovnom prikazu.</p><Link className={styles.button} href="/settings">Otvori moj nalog</Link></section>
      : result.shifts.length === 0 ? <section className={styles.notice}><h2>Još nema javnih oglasa{city ? ` za ${city}` : ''}</h2><p>Ovdje će se prikazivati odobreni oglasi za kratke smjene. Postojeće privatne lokacije nijesu prenijete u javni pregled.</p><Link className={styles.button} href="/shifts">Prikaži sve gradove</Link></section>
      : <div className={styles.list}>{result.shifts.map((shift) => <Link className={styles.listing} key={shift.shift_id} href={`/shifts/${shift.shift_id}`}>
        {shift.is_sos && <p className={styles.kicker}>SOS · Promovisan oglas</p>}<p>{shift.employer_name} · {shift.city}</p><h2>{shift.role}</h2><p>{publicShiftTime(shift.starts_at)} — {publicShiftTime(shift.ends_at)}</p><p>{shift.location_area} · Broj mjesta: {shift.workers_needed}</p><span className={styles.pay}>€{(shift.pay_cents / 100).toFixed(2)}</span><p>Ponuđeno po osobi za smjenu · Pogledaj uslove →</p>
      </Link>)}</div>}
  </MarketplaceShell>;
}
