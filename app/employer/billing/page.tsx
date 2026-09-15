import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { SosForm, type SosCredit } from '@/components/marketplace/sos-form';
import { RefreshApplications } from '@/components/marketplace/application-controls';
import { publicShiftTime } from '@/lib/public-shifts';
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
  const { client, user, now } = await applicationSession(next);
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

  const instant = new Date(now).toISOString();
  const [balances, credits, posts, terms] = await Promise.all([
    client.from('employer_credit_totals').select('kind,remaining_units').eq('employer_id', selected.id),
    client.from('employer_credit_balances').select('id,remaining_units,sos_duration_minutes,expires_at').eq('employer_id', selected.id).eq('kind', 'sos_promotion')
      .is('revoked_at', null).lte('starts_at', instant).gt('expires_at', instant).gt('remaining_units', 0).order('expires_at').limit(100),
    client.from('application_posts').select('shift_id,role,starts_at,status').eq('employer_id', selected.id).order('created_at', { ascending: false }).limit(100),
    client.rpc('application_posting_terms', { target_employer: selected.id }),
  ]);
  const ids = posts.data?.map((post) => post.shift_id) ?? [];
  const promotions = ids.length ? await client.from('shift_sos_promotions').select('id,shift_id,starts_at,ends_at,stopped_at').in('shift_id', ids).order('starts_at', { ascending: false }).limit(100) : { data: [], error: null };
  const error = balances.error || credits.error || posts.error || promotions.error || terms.error;
  const data = balances.data;
  const availableCredits = (credits.data ?? []).filter((credit) => credit.sos_duration_minutes !== null) as SosCredit[];
  const openPosts = (posts.data ?? []).filter((post) => post.status === 'open' && Date.parse(post.starts_at) > now);
  const active = new Set((promotions.data ?? []).filter((promotion) => !promotion.stopped_at && Date.parse(promotion.starts_at) <= now && Date.parse(promotion.ends_at) > now).map((promotion) => promotion.shift_id));
  const postingTerms = (terms.data as { enabled: boolean; requires_credit: boolean }[] | null)?.[0];
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
      <p>Kupovina paketa još nije dostupna. Ovdje ne plaćaš karticom niti ugovaraš pretplatu. Možeš koristiti prethodno odobrene kredite; kredit nije dokaz da je izvršeno plaćanje.</p>
    </aside>
    {error ? <section className={styles.error} role="alert"><h2>Pregled kredita nije dostupan</h2>
      <p>Ne možemo potvrditi stanje. Pokušaj ponovo; greška ne znači da imaš nula kredita.</p>
      {/* Full navigation deliberately retries a failed read rather than reusing a cached route. */}
      <a className={styles.secondary} href={next}>Pokušaj ponovo</a>
    </section> : <section className={styles.panel}><h2>Evidentirani krediti</h2>
      <dl className={styles.detail}><div><dt>Standardne objave</dt><dd>{totals.standard_post}</dd></div>
        <div><dt>SOS promocije</dt><dd>{totals.sos_promotion}</dd></div></dl>
      <p>Prikazani su samo neiskorišćeni krediti koji nijesu istekli ili opozvani. Evidentiran kredit nije potvrda plaćanja, objavljenog oglasa ili aktivne promocije.</p>
      <p>{postingTerms?.requires_credit ? 'Standardna objava koristi 1 kredit, uz potvrdu vlasnika firme.' : 'Objavljivanje za ovu firmu trenutno ne troši standardne kredite.'}</p>
    </section>}
    {!error && <section className={styles.panel}><h2>SOS — dodatna vidljivost</h2>
      <p>Promovisani oglasi idu ispred ostalih u izabranom gradu; među njima redosljed određuje početak smjene. SOS nije garancija prijava, angažovanja ili provjere firme. Promocija se prikazuje samo dok je oglas javan i otvoren.</p>
      <RefreshApplications />
      {!availableCredits.length && <p>Nema važećih SOS kredita sa odobrenim trajanjem. Kupovina još nije dostupna; ne naplaćuje se ništa automatski.</p>}
      {!openPosts.length && <p>Za promociju prvo objavi buduću smjenu.</p>}
      {postingTerms?.enabled && openPosts.map((post) => <details key={post.shift_id} className={styles.notice}><summary className={styles.secondary}>{post.role} · {publicShiftTime(post.starts_at)}</summary>
        {active.has(post.shift_id) ? <p>SOS je aktivan. Drugi kredit neće biti iskorišćen dok ova promocija traje.</p>
          : availableCredits.length > 0 ? <SosForm key={post.shift_id} shift={post.shift_id} credits={availableCredits} requestId={randomUUID()} /> : <p>Za ovaj oglas trenutno nema SOS kredita.</p>}
      </details>)}
      {(promotions.data?.length ?? 0) > 0 && <><h3>Evidencija promocija</h3><ul className={styles.list}>{promotions.data!.map((promotion) => {
        const post = posts.data?.find((item) => item.shift_id === promotion.shift_id);
        return <li key={promotion.id}><strong>{post?.role ?? 'Oglas'}</strong><p>{publicShiftTime(promotion.starts_at)} — {publicShiftTime(promotion.ends_at)}</p>
          <p>{!postingTerms?.enabled || post?.status !== 'open' || promotion.stopped_at ? 'Promocija se više ne prikazuje.' : Date.parse(promotion.ends_at) <= now ? 'Trajanje je isteklo.' : Date.parse(promotion.starts_at) > now ? 'Promocija još nije počela.' : 'SOS isticanje je aktivno.'}</p></li>;
      })}</ul></>}
      <p>Pregled obuhvata do 100 najnovijih oglasa i promocija. Otkazivanje oglasa odmah uklanja javno isticanje. Automatski povrat kredita nije implementiran; politika povrata čeka komercijalnu i pravnu potvrdu.</p>
    </section>}
    <section className={styles.notice}><h2>Naknada radniku je zaseban dogovor</h2>
      <p>Radnici koriste SMJENU besplatno. SMJENA ne obračunava niti isplaćuje zarade i ne uzima procenat ponuđene naknade. Poslodavac je odgovoran za ugovaranje i plaćanje rada.</p>
      <p>Nacrt objašnjenja odgovornosti — potrebna je provjera pravnika u Crnoj Gori prije javnog lansiranja.</p>
    </section>
    <Link className={styles.button} href={`/employer/shifts?workspace=${selected.id}`}>Oglasi ove firme</Link>
  </MarketplaceShell>;
}
