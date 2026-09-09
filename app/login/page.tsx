import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { PublicBrand } from '@/components/marketing/public-brand';
import styles from '@/components/marketing/public.module.css';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Prijava | SMJENA',
  description: 'Prijavi se ili otvori radnički ili poslovni SMJENA nalog.',
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; intent?: string; role?: string }>;
}) {
  if (!isSupabaseConfigured()) return <MissingConfiguration />;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');
  const params = await searchParams;
  const intent =
    params.intent === 'register' && !params.error ? 'register' : 'login';
  const role = params.role === 'employer' ? 'employer' : 'worker';

  return (
    <div className={styles.authPage}>
      <header className={styles.header}>
        <PublicBrand />
        <nav aria-label="Povratak">
          <Link href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Početna
          </Link>
        </nav>
      </header>
      <main id="main-content" className={styles.authMain}>
        <aside className={styles.authStory} aria-label="Zašto SMJENA">
          <p className={styles.kicker}>TVOJ GRAD. TVOJI LJUDI.</p>
          <h2>
            Dobar posao
            <br />
            počinje
            <br />
            <span>dogovorom.</span>
          </h2>
          <p>
            Jasni uslovi. Ukupna naknada unaprijed. Kontakt za dogovor nakon
            potvrde smjene.
          </p>
          <div className={styles.authStoryFoot}>
            <LockKeyhole size={20} aria-hidden="true" />
            <span>
              Jedan siguran link.
              <br />
              Tvoj ulaz u SMJENU.
            </span>
          </div>
        </aside>
        <section className={styles.authPanel}>
          {params.error === 'auth_callback' && (
            <p role="alert" className={styles.authError}>
              Link nije važeći ili je istekao. Zatraži novi link ispod.
            </p>
          )}
          <LoginForm
            key={`${intent}-${role}`}
            initialIntent={intent}
            initialRole={role}
          />
        </section>
      </main>
    </div>
  );
}

function MissingConfiguration() {
  return (
    <div className={styles.authPage}>
      <header className={styles.header}>
        <PublicBrand />
      </header>
      <main id="main-content" className={styles.authMain}>
        <section>
          <h1 className="text-3xl font-bold">
            Prijava trenutno nije dostupna.
          </h1>
          <p className="my-5">Pokušaj ponovo kasnije. Hvala na strpljenju.</p>
          <Link href="/" className={styles.primary}>
            Vrati se na početnu
          </Link>
        </section>
      </main>
    </div>
  );
}
