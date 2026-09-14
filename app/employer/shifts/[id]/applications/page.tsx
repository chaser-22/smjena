import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MarketplaceShell } from '@/components/marketplace/shell';
import { ApplicationControl, RefreshApplications } from '@/components/marketplace/application-controls';
import styles from '@/components/marketplace/marketplace.module.css';
import { applicationSession, getApplicationContact, listApplications, type ApplicationPost } from '@/lib/application-data';
import { statusLabels } from '@/lib/applications';
import { publicShiftTime } from '@/lib/public-shifts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prijave za smjenu | SMJENA', robots: { index: false, follow: false } };

export default async function EmployerApplications({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user, now } = await applicationSession(`/employer/shifts/${id}/applications`);
  const { data, error } = await client.from('application_posts').select('*').eq('shift_id', id).maybeSingle();
  if (error) throw new Error('Shift unavailable');
  if (!data) notFound();
  const post = data as ApplicationPost;
  const membership = await client.from('employer_members').select('employer_id').eq('employer_id', post.employer_id).eq('user_id', user.id).maybeSingle();
  if (membership.error) throw new Error('Membership unavailable');
  if (!membership.data) notFound();
  const [applications, accepted, offered, applied] = await Promise.all([
    listApplications(client, { shift: id }), ...(['accepted', 'offered', 'applied'] as const).map((status) => client.from('application_inbox').select('id', { head: true, count: 'exact' }).eq('shift_id', id).eq('effective_status', status)),
  ]);
  if (accepted.error || offered.error || applied.error) throw new Error('Counts unavailable');
  const contacts = new Map(await Promise.all(applications.filter((application) => application.effective_status === 'accepted').map(async (application) => [application.id, await getApplicationContact(client, application.id)] as const)));
  const open = post.status === 'open' && new Date(post.starts_at).getTime() > now;
  return <MarketplaceShell><Link className={styles.secondary} href={`/employer/shifts?workspace=${post.employer_id}`}>← Oglasi firme</Link><p className={styles.kicker}>{post.employer_name}</p><h1>{post.role}</h1>
    <p>{publicShiftTime(post.starts_at)} · €{(post.pay_cents / 100).toFixed(2)} po osobi</p>
    <p className={styles.notice}>{post.status === 'cancelled' ? 'Oglas je otkazan.' : `${accepted.count ?? 0} od ${post.workers_needed} prihvaćenih · ${offered.count ?? 0} ponuda čeka odgovor · ${applied.count ?? 0} prijava čeka pregled`}</p>
    <p className={styles.intro}>Ponuda traje najviše 30 minuta, do početka smjene. Čuva mjesto dok radnik ne odgovori. Kontakt dobijaš tek nakon prihvatanja. Automatsko osvježavanje: 20 sekundi.</p><RefreshApplications />
    {!applications.length && <section className={styles.notice}><h2>Još nema prijava</h2><p>Niko nije automatski dodijeljen ovoj smjeni.</p><Link href={`/shifts/${post.shift_id}`} className={styles.secondary}>Otvori javni oglas</Link></section>}
    <div className={styles.list}>{applications.map((application) => {
      const status = application.effective_status;
      const contact = contacts.get(application.id);
      return <article key={application.id} className={styles.panel}><p className={styles.kicker}>{statusLabels[status]}</p><h2>{application.worker_name}</h2><p>Prijava radnika — nije potvrda provjere identiteta, dolaska ili plaćanja.</p>
        {status === 'offered' && <p>Rok za odgovor: {publicShiftTime(application.offer_expires_at!)}</p>}
        {contact && <a className={styles.secondary} href={`tel:${contact.phone}`}>Pozovi radnika: {contact.phone}</a>}
        {open && status === 'applied' && <><ApplicationControl id={application.id} decision="offer" label="Pošalji ponudu" /><ApplicationControl id={application.id} decision="reject" label="Odbij prijavu" /></>}
        {open && ['offered', 'accepted'].includes(status) && <details><summary className={styles.secondary}>Povuci ponudu / dogovor</summary><ApplicationControl id={application.id} decision="revoke" label="Potvrdi povlačenje" confirmation="Razumijem da se mjesto oslobađa i kontakt uklanja. Direktno ću obavijestiti radnika ako smo već dogovorili angažovanje. Ovo ne raskida ugovor automatski." /></details>}
      </article>;
    })}</div>
    {applications.length === 200 && <p>Prikazano je 200 najnovijih prijava. Brojači iznad obuhvataju sve prijave.</p>}
    {open && <details className={styles.notice}><summary className={styles.secondary}>Otkaži cijeli oglas</summary><ApplicationControl id={id} decision="cancel-post" label="Otkaži oglas i sve aktivne prijave" confirmation="Otkazujem oglas i aktivne ponude. Prethodno ću obavijestiti prihvaćene radnike i riješiti obaveze iz direktnog dogovora." /></details>}
  </MarketplaceShell>;
}
