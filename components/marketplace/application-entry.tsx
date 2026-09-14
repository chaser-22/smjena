import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ApplicationControl } from './application-controls';
import { statusLabels, type ApplicationStatus } from '@/lib/applications';
import styles from './marketplace.module.css';

export async function ApplicationEntry({ shiftId }: { shiftId: string }) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return <Link className={styles.button} href={`/login?next=/shifts/${shiftId}`}>Prijavi se na nalog za prijavu na smjenu</Link>;
  const [worker, application] = await Promise.all([
    client.from('worker_profiles').select('user_id').eq('user_id', data.user.id).maybeSingle(),
    client.from('application_inbox').select('effective_status').eq('worker_id', data.user.id).eq('shift_id', shiftId).maybeSingle(),
  ]);
  if (worker.error || application.error) return <p>Ne možemo provjeriti tvoju prijavu. <Link className={styles.secondary} href="/applications">Otvori prijave i osvježi status</Link></p>;
  if (application.data) return <><p>{statusLabels[application.data.effective_status as ApplicationStatus]}</p><Link className={styles.button} href="/applications">Otvori moju prijavu</Link></>;
  if (!worker.data) return <Link className={styles.button} href="/settings">Dodaj radnički profil za prijavu</Link>;
  return <ApplicationControl id={shiftId} decision="apply" label="Pošalji prijavu" />;
}
