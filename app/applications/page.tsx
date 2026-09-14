import Link from 'next/link';
import { MarketplaceShell } from '@/components/marketplace/shell';
import { ApplicationControl, ApplicationPhoneForm, RefreshApplications } from '@/components/marketplace/application-controls';
import { EmployerResponsibility } from '@/components/marketplace/responsibility';
import styles from '@/components/marketplace/marketplace.module.css';
import { applicationSession, getApplicationContact, listApplications, type ApplicationPost } from '@/lib/application-data';
import { statusLabels } from '@/lib/applications';
import { publicShiftTime } from '@/lib/public-shifts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moje prijave | SMJENA', robots: { index: false, follow: false } };

export default async function ApplicationsPage() {
  const { client, user, now } = await applicationSession('/applications');
  const [applications, contact, worker] = await Promise.all([
    listApplications(client, { worker: user.id }), client.from('worker_contacts').select('phone').eq('user_id', user.id).maybeSingle(),
    client.from('worker_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  if (contact.error || worker.error) throw new Error('Worker account unavailable');
  if (!worker.data) return <MarketplaceShell><h1>Moje prijave</h1><p className={styles.intro}>Za prijavljivanje na smjene dodaj radnički profil na isti nalog. Tvoje firme ostaju odvojene.</p><Link className={styles.button} href="/settings">Dodaj radnički profil</Link></MarketplaceShell>;
  const ids = [...new Set(applications.map((application) => application.shift_id))];
  const posts = ids.length ? await client.from('application_posts').select('*').in('shift_id', ids) : { data: [], error: null };
  if (posts.error) throw new Error('Posts unavailable');
  const postMap = new Map((posts.data as ApplicationPost[]).map((post) => [post.shift_id, post]));
  const contacts = new Map(await Promise.all(applications.filter((application) => application.effective_status === 'accepted').map(async (application) => [application.id, await getApplicationContact(client, application.id)] as const)));
  return <MarketplaceShell><p className={styles.kicker}>Tvoji sljedeći koraci</p><h1>Moje prijave</h1>
    <p className={styles.intro}>Prijava ne rezerviše mjesto. Poslodavac šalje ponudu, a ti odlučuješ. Status se provjerava svakih 20 sekundi dok je stranica otvorena.</p>
    <RefreshApplications /><ApplicationPhoneForm phone={contact.data?.phone ?? null} />
    {!applications.length ? <section className={styles.notice}><h2>Još nemaš prijava</h2><p>Pronađi smjenu koja ti odgovara. Ne treba ti CV.</p><Link href="/shifts" className={styles.button}>Pogledaj smjene</Link></section> : <div className={styles.list}>
      {applications.map((application) => {
        const post = postMap.get(application.shift_id);
        if (!post) return null;
        const status = application.effective_status;
        const nextContact = contacts.get(application.id);
        const beforeStart = new Date(post.starts_at).getTime() > now;
        return <article className={styles.panel} key={application.id}>
          <p className={styles.kicker}>{statusLabels[status]}</p><h2>{post.role} · {post.employer_name}</h2>
          <p>{post.city} · {post.location_area}</p><p>{publicShiftTime(post.starts_at)} — {publicShiftTime(post.ends_at)}</p>
          <p className={styles.pay}>€{(post.pay_cents / 100).toFixed(2)}</p><p>Ponuđeno po osobi za smjenu. Nije potvrda isplate.</p>
          {status === 'applied' && <p>Poslodavac još nije poslao ponudu. Možeš pregledati druge smjene.</p>}
          {status === 'offered' && <><p className={styles.notice}>Odgovori do {publicShiftTime(application.offer_expires_at!)}. Mjesto je privremeno zadržano dok ponuda važi.</p>
            <ApplicationControl id={application.id} decision="accept" label="Prihvati ponudu" confirmation="Pročitao/la sam termin i naknadu. Prihvatanjem otkrivam kontakt poslodavcu; zakonito angažovanje dogovaramo direktno." />
            <ApplicationControl id={application.id} decision="decline" label="Odbij ponudu" /></>}
          {status === 'accepted' && <div className={styles.success}><p>Ponuda je prihvaćena. Dogovorite zakonit osnov angažovanja i praktične detalje direktno. SMJENA ne potvrđuje dolazak ni plaćanje.</p>
            {nextContact ? <><p>{nextContact.exact_address}</p><a className={styles.secondary} href={`tel:${nextContact.phone}`}>Pozovi poslodavca: {nextContact.phone}</a></> : <p>Kontakt više nije dostupan nakon isteka termina ili otkazivanja.</p>}</div>}
          {['applied', 'offered', 'accepted'].includes(status) && beforeStart && post.status === 'open' && <details><summary className={styles.secondary}>{status === 'accepted' ? 'Povuci prihvatanje' : 'Povuci prijavu'}</summary>
            <ApplicationControl id={application.id} decision="withdraw" label="Potvrdi povlačenje" confirmation="Razumijem da gubim mjesto/ponudu i pristup kontaktu. Ako postoji direktan dogovor, prethodno ću obavijestiti poslodavca. Ovo ne raskida ugovor automatski." /></details>}
          <Link className={styles.secondary} href="/shifts">Pogledaj druge smjene</Link>
        </article>;
      })}
    </div>}
    {applications.length === 200 && <p>Prikazano je 200 najnovijih prijava. Pregled starije istorije još nije dostupan u pilotu.</p>}
    <EmployerResponsibility />
  </MarketplaceShell>;
}
