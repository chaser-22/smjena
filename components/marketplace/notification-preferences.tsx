'use client';
import { useState } from 'react';
import { setApplicationPush } from '@/app/notifications/actions';
import styles from './marketplace.module.css';

export function NotificationPreferences({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function change() {
    setPending(true); setMessage('');
    try {
      let subscription: PushSubscriptionJSON | undefined;
      if (!enabled) {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Obavijesti nijesu dostupne u ovom pregledaču. Na iPhone-u dodaj SMJENU na početni ekran.');
        if (await Notification.requestPermission() !== 'granted') throw new Error('Dozvola nije uključena. Sve promjene i dalje vidiš ovdje.');
        await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        let readyTimeout: ReturnType<typeof setTimeout> | undefined;
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => { readyTimeout = setTimeout(() => reject(new Error('Priprema obavijesti traje duže. Pokušaj ponovo.')), 10000); }),
        ]).finally(() => clearTimeout(readyTimeout));
        const binary = atob((key + '='.repeat((4-key.length%4)%4)).replace(/-/g, '+').replace(/_/g, '/'));
        const applicationServerKey = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const push = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        subscription = push.toJSON();
      }
      const result = await setApplicationPush(!enabled, subscription);
      if ('error' in result) throw new Error(result.error);
      setEnabled(result.enabled);
      setMessage(result.enabled ? 'Obavijesti o prijavama i ponudama su uključene.' : 'Push obavijesti o prijavama i ponudama su isključene za ovaj nalog. Obavijesti u aplikaciji ostaju dostupne.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Veza je prekinuta. Provjeri podešavanje prije novog pokušaja.'); }
    finally { setPending(false); }
  }
  return <section className={styles.panel}><h2>Prijave i ponude — obavijesti</h2>
    <p>Dobij promjene statusa i dozvoljene pozive firmi i kada SMJENA nije otvorena. Dostava zavisi od pregledača i uređaja. Pozive firmi možeš posebno isključiti u „Moje prijave”.</p>
    <button className={styles.button} disabled={pending} onClick={change}>{pending ? 'Čuvam podešavanje…' : enabled ? 'Isključi push obavijesti' : 'Uključi push obavijesti'}</button>
    {message && <p aria-live="polite" className={styles.notice}>{message}</p>}
  </section>;
}
