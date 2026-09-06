import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Zap } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/smjena/shared';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Prijava | SMJENA',
  description: 'Prijavi se ili otvori radnički ili poslovni SMJENA nalog.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured()) return <MissingConfiguration />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');
  const params = await searchParams;

  return (
    <main id="main-content" className="min-h-screen overflow-x-hidden bg-[#f4f1eb] px-4 py-8 text-[#101d34] sm:py-14">
      <div className="mx-auto mb-8 max-w-5xl"><Brand /></div>
      <div className="mx-auto grid w-[calc(100vw-2rem)] min-w-0 max-w-5xl grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-2xl shadow-[#101d34]/10 lg:w-full lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#101d34] p-8 text-white sm:p-12 lg:block">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-[#ff5b35]/20 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em]"><Zap className="size-3 fill-current text-[#ff7a59]" /> Mreža hitnog rada</span>
            <h1 className="mt-8 max-w-md text-4xl font-black tracking-[-.05em] sm:text-5xl">Jedan nalog. Stvarne smjene. Stvarna zarada.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/60">SMJENA povezuje ugostiteljske radnike i poslodavce u Crnoj Gori—sa jasnom cijenom, evidencijom dolaska i pouzdanošću koja se gradi svakim završenim poslom.</p>
            <div className="mt-10 flex items-center gap-3 text-xs font-bold text-white/70"><ShieldCheck className="size-5 text-[#77f0bd]" /> Nalog i podaci zaštićeni su pravilima pristupa u bazi.</div>
          </div>
        </section>
        <section className="min-w-0 p-6 sm:p-12">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#ff5b35]">Prijava ili novi nalog</p>
          <h2 className="mt-2 text-[clamp(1.75rem,8vw,2rem)] font-black tracking-[-.04em]">Dobro došao u SMJENU</h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">Ako već imaš nalog, treba ti samo email. Novi korisnici prvo biraju svoju ulogu.</p>
          {params.error === 'auth_callback' && <p role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">Link nije važeći ili je istekao. Zatraži novi link ispod.</p>}
          <LoginForm />
        </section>
      </div>
    </main>
  );
}

function MissingConfiguration() {
  return <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1eb] p-6"><section className="max-w-lg rounded-[28px] border border-amber-200 bg-white p-8 text-[#101d34] shadow-xl"><p className="text-xs font-black uppercase tracking-[.14em] text-amber-600">Produkcijska konfiguracija</p><h1 className="mt-2 text-3xl font-black">Poveži Supabase projekat</h1><p className="mt-3 text-sm leading-6 text-slate-600">Dodaj Supabase URL i publishable key u <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>, zatim pokreni migraciju iz <code className="rounded bg-slate-100 px-1.5 py-0.5">supabase/migrations</code>.</p></section></main>;
}
