import Link from 'next/link';
import { MarketplaceShell } from '@/components/marketplace/shell';
import styles from '@/components/marketplace/marketplace.module.css';
import { getAccountAccess } from '@/lib/account-data';
import { applicationSession } from '@/lib/application-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Objave i promocije | SMJENA', robots: { index: false, follow: false } };

export default async function EmployerBilling({ searchParams }: {
  searchParams: Promise<{ workspace?: string | string[] }>;
}) {
  const { workspace } = await searchParams;
  const next = typeof workspace === 'string' && /^[0-9a-f-]{36}$/.test(workspace)
    ? `/employer/billing?workspace=${workspace}` : '/employer/billing';
  const { client, user } = await applicationSession(next);
  const access = await getAccountAccess(user.id);
  const owned = access.workspaces.filter((item) => item.memberRole === 'owner');
  const selected = owned.find((item) => item.id === workspace);
  if (!selected) return <MarketplaceShell>
    <h1>Objave i promocije</h1>
    <p>Izaberi firmu čiji nalog vodiš. Ovaj pregled je dostupan vlasniku naloga firme.</p>
    <ul className={styles.workspaces}>{owned.map((item) => <li key={item.id}>
      <Link className={styles.secondary} href={`/employer/billing?workspace=${item.id}`}>{item.name} →</Link>
    </li>)}</ul>
    {!owned.length && <p className={styles.notice}>Nemaš vlasnički pristup nalogu firme. Krediti drugih firmi nijesu vidljivi.</p>}
    <Link className={styles.button} href="/settings">Moj nalog</Link>
  </MarketplaceShell>;

  const { data, error } = await client.from('employer_credit_totals')
    .select('kind,remaining_units').eq('employer_id', selected.id);
  const totals = { standard_post: 0, sos_promotion: 0 };
  for (const credit of data ?? []) {
    if (credit.kind === 'standard_post' || credit.kind === 'sos_promotion') {
      totals[credit.kind as keyof typeof totals] += credit.remaining_units;
    }
  }
  return <MarketplaceShell>
    <Link className={styles.secondary} href="/employer/billing">← Promijeni firmu</Link>
    <p className={styles.kicker}>{selected.name}</p><h1>Objave i promocije</h1>
    <p className={styles.intro}>Objava oglasa i dodatna SOS vidljivost su odvojene usluge. Nijedna ne povećava naknadu koju nudiš radniku.</p>
    <aside className={styles.notice}><h2>Naplata još nije uključena</h2>
      <p>Kupovina paketa i aktivacija SOS promocija još nijesu dostupne. Ovdje ne plaćaš ništa niti ugovaraš pretplatu. Pilot-pristup objavljivanju odobrava se odvojeno od kredita.</p>
    </aside>
    {error ? <section className={styles.error} role="alert"><h2>Pregled kredita nije dostupan</h2>
      <p>Ne možemo potvrditi stanje. Pokušaj ponovo; greška ne znači da imaš nula kredita.</p>
      {/* Full navigation deliberately retries a failed read rather than reusing a cached route. */}
      <a className={styles.secondary} href={next}>Pokušaj ponovo</a>
    </section> : <section className={styles.panel}><h2>Evidentirani krediti</h2>
      <dl className={styles.detail}><div><dt>Standardne objave</dt><dd>{totals.standard_post}</dd></div>
        <div><dt>SOS promocije</dt><dd>{totals.sos_promotion}</dd></div></dl>
      <p>Prikazani su samo neiskorišćeni krediti koji nijesu istekli ili opozvani. Evidentiran kredit nije potvrda plaćanja, objavljenog oglasa ili aktivne promocije.</p>
    </section>}
    <section className={styles.notice}><h2>Naknada radniku je zaseban dogovor</h2>
      <p>Radnici koriste SMJENU besplatno. SMJENA ne obračunava niti isplaćuje zarade i ne uzima procenat ponuđene naknade. Poslodavac je odgovoran za ugovaranje i plaćanje rada.</p>
      <p>Nacrt objašnjenja odgovornosti — potrebna je provjera pravnika u Crnoj Gori prije javnog lansiranja.</p>
    </section>
    <Link className={styles.button} href={`/employer/shifts?workspace=${selected.id}`}>Oglasi ove firme</Link>
  </MarketplaceShell>;
}
