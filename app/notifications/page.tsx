import Link from 'next/link';
import { after } from 'next/server';
import { MarketplaceShell } from '@/components/marketplace/shell';
import { RefreshApplications } from '@/components/marketplace/application-controls';
import { NotificationPreferences } from '@/components/marketplace/notification-preferences';
import { applicationSession } from '@/lib/application-data';
import { applicationNotificationText } from '@/lib/push-safety';
import { deliverApplicationNotifications } from '@/lib/application-notifications';
import { publicShiftTime } from '@/lib/public-shifts';
import { markNotificationRead } from './actions';
import styles from '@/components/marketplace/marketplace.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Obavijesti | SMJENA', robots: { index: false, follow: false } };
export default async function NotificationsPage() {
  const { client, user } = await applicationSession('/notifications');
  const [notices, preferences] = await Promise.all([
    client.from('marketplace_notifications').select('id,kind,destination,created_at,read_at').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(100),
    client.from('notification_preferences').select('application_push').eq('user_id', user.id).maybeSingle(),
  ]);
  if (notices.error || preferences.error) throw new Error('Obavijesti trenutno nijesu dostupne.');
  after(deliverApplicationNotifications);
  return <MarketplaceShell><h1>Obavijesti</h1><p className={styles.intro}>Promjene tvojih prijava i oglasa. Otvori prijavu za najnoviji status; obavijest opisuje događaj u trenutku kada je nastala.</p>
    <NotificationPreferences enabled={preferences.data?.application_push ?? false} /><RefreshApplications />
    {!notices.data.length ? <p className={styles.notice}>Još nema novih događaja. Ovdje ćeš vidjeti prijave, ponude i odgovore.</p> : <ul className={styles.list}>
      {notices.data.map((notice) => <li className={styles.panel} key={notice.id}><p className={styles.kicker}>{notice.read_at ? 'Pregledano' : 'Novo'} · {publicShiftTime(notice.created_at)}</p>
        <h2>{applicationNotificationText[notice.kind] ?? 'Status je promijenjen.'}</h2>
        <Link className={styles.button} href={notice.destination}>Otvori trenutni status</Link>
        {!notice.read_at && <form action={markNotificationRead.bind(null, notice.id)}><button className={styles.secondary}>Označi kao pregledano</button></form>}
      </li>)}
    </ul>}
    {notices.data.length===100 && <p>Prikazano je 100 najnovijih obavijesti.</p>}
  </MarketplaceShell>;
}
