import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { MarketplaceShell } from '@/components/marketplace/shell';
import { EnableWorkerForm, CreateWorkspaceForm } from '@/components/marketplace/account-forms';
import styles from '@/components/marketplace/marketplace.module.css';
import { getAccountAccess } from '@/lib/account-data';
import { dashboardHref } from '@/lib/account-context';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { logoutAction } from '@/app/dashboard/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moj nalog | SMJENA', robots: { index: false, follow: false } };

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect('/login?next=/settings');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login?next=/settings');
  const access = await getAccountAccess(data.user.id);
  return <MarketplaceShell>
    <p className={styles.kicker}>Jedan nalog. Više mogućnosti.</p>
    <h1>Zdravo, {access.name}.</h1>
    <p className={styles.intro}>Izaberi svoj radnički profil ili firmu. Isti email možeš koristiti za oboje. Promjena prikaza ne mijenja tvoja ovlašćenja.</p>
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h2>Radnički profil</h2>
        <p>Koristi SMJENU kao radnik, nezavisno od firmi kojima pripadaš.</p>
        {access.worker ? <Link className={styles.button} href="/dashboard?mode=worker">Otvori radnički profil</Link> : <EnableWorkerForm />}
        <p className="mt-4 text-sm">Kontakt telefon, dostupnost i obavijesti uređuješ u radničkom prikazu.</p>
      </section>
      <section className={styles.panel}>
        <h2>Moje firme</h2>
        {access.workspaces.length ? <ul className={styles.workspaces}>{access.workspaces.map((workspace) => <li key={workspace.id} className={styles.workspace}>
          <div><strong>{workspace.name}</strong><p className="text-sm">{workspace.memberRole === 'owner' ? 'Vlasnik naloga firme' : 'Menadžer'}</p></div>
          <Link href={dashboardHref({ role: 'employer', employerId: workspace.id })}>Otvori firmu →</Link>
        </li>)}</ul> : <p>Još nijesi povezan/a sa firmom.</p>}
        <p className="text-sm">Kontakt i smjene svake firme su odvojeni. Za pristup postojećoj firmi obrati se njenom vlasniku; nemoj praviti duplikat.</p>
        <details className="mt-5"><summary className="min-h-11 cursor-pointer py-3 font-bold">Dodaj novu firmu</summary>
          <CreateWorkspaceForm city={access.city} requestId={randomUUID()} />
        </details>
      </section>
    </div>
    <form action={logoutAction}><button className={styles.button}>Odjavi se</button></form>
  </MarketplaceShell>;
}
