import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { MarketplaceShell } from '@/components/marketplace/shell';
import { ApplicationPhoneForm, PublishApplicationForm } from '@/components/marketplace/application-controls';
import { EmployerResponsibility } from '@/components/marketplace/responsibility';
import styles from '@/components/marketplace/marketplace.module.css';
import { getAccountAccess } from '@/lib/account-data';
import { applicationSession, type ApplicationPost } from '@/lib/application-data';
import { publicShiftTime } from '@/lib/public-shifts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Oglasi firme | SMJENA', robots: { index: false, follow: false } };

export default async function EmployerShifts({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const { client, user, now } = await applicationSession('/employer/shifts');
  const access = await getAccountAccess(user.id);
  const selected = access.workspaces.find((item) => item.id === workspace);
  if (!selected) return <MarketplaceShell><h1>Izaberi firmu</h1><p>Oglasi i prijave pripadaju izabranoj firmi.</p>
    <ul className={styles.workspaces}>{access.workspaces.map((item) => <li key={item.id}><Link className={styles.secondary} href={`/employer/shifts?workspace=${item.id}`}>{item.name} →</Link></li>)}</ul>
    {!access.workspaces.length && <Link href="/settings" className={styles.button}>Dodaj firmu u podešavanjima</Link>}
  </MarketplaceShell>;
  const [posts, pilot, contact] = await Promise.all([
    client.from('application_posts').select('*').eq('employer_id', selected.id).order('created_at', { ascending: false }).limit(100),
    client.rpc('application_posting_terms', { target_employer: selected.id }),
    client.from('employer_contacts').select('phone').eq('employer_id', selected.id).maybeSingle(),
  ]);
  if (posts.error || pilot.error || contact.error) throw new Error('Employer posts unavailable');
  const terms = (pilot.data as { enabled: boolean; requires_credit: boolean; can_publish: boolean }[])[0];
  return <MarketplaceShell><Link className={styles.secondary} href="/employer/shifts">← Promijeni firmu</Link><p className={styles.kicker}>{selected.name}</p><h1>Oglasi za smjene</h1>
    <p className={styles.intro}>Objavi uslove. Pregledaj prijave. Pošalji ponudu osobi koju izabereš. Dogovor je potvrđen u aplikaciji tek kada radnik prihvati.</p>
    {selected.memberRole === 'owner' && <Link className={styles.secondary} href={`/employer/billing?workspace=${selected.id}`}>Objave i promocije — pregled kredita</Link>}
    <ApplicationPhoneForm key={selected.id} phone={contact.data?.phone ?? null} workspace={selected.id} />
    {terms?.can_publish ? <details className={styles.panel}><summary className={styles.secondary}>Objavi novu smjenu</summary><p>{terms.requires_credit ? 'Objava koristi 1 važeći standardni kredit. Neuspjela objava ne troši kredit.' : 'Za ovu firmu objavljivanje trenutno ne troši standardne kredite.'}</p><PublishApplicationForm key={`${selected.id}-${terms.requires_credit}`} workspace={selected.id} businessName={selected.name} requestId={randomUUID()} requiresCredit={terms.requires_credit} /><EmployerResponsibility /></details>
      : terms?.enabled ? <p className={styles.notice}>Objava koristi kredit firme. Obrati se vlasniku naloga da objavi smjenu.</p>
      : <aside className={styles.notice}><h2>Novi model je u pripremi</h2><p>Objavljivanje kroz prijave još nije omogućeno za ovu firmu. Uključivanje pilot-firme zahtijeva odobrenje; ovdje se ništa ne naplaćuje.</p></aside>}
    <div className={styles.list}>{(posts.data as ApplicationPost[]).map((post) => <article className={styles.panel} key={post.shift_id}><p className={styles.kicker}>{post.status === 'cancelled' ? 'Otkazano' : new Date(post.starts_at).getTime() <= now ? 'Termin prijava je završen' : 'Oglas otvoren'}</p><h2>{post.role}</h2><p>{publicShiftTime(post.starts_at)} · {post.workers_needed} mjesta · €{(post.pay_cents / 100).toFixed(2)} po osobi</p><Link className={styles.button} href={`/employer/shifts/${post.shift_id}/applications`}>Pregledaj prijave</Link></article>)}</div>
    {!posts.data.length && <p className={styles.notice}>Još nema oglasa ove firme u novom modelu. Ranije smjene su sačuvane u prethodnom prikazu.</p>}
  </MarketplaceShell>;
}
