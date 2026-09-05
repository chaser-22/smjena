import Link from 'next/link';
import { Brand } from '@/components/smjena/shared';

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1eb] p-6 text-[#101d34]">
      <section className="max-w-md text-center">
        <div className="flex justify-center"><Brand /></div>
        <p className="mt-8 text-xs font-black uppercase tracking-[.14em] text-[#ff5b35]">Stranica nije pronađena</p>
        <h1 className="mt-3 text-3xl font-black">Ovdje nema smjene</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Link možda više nije važeći ili je adresa pogrešno unesena.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#101d34] px-6 text-sm font-bold text-white">Nazad u SMJENU</Link>
      </section>
    </main>
  );
}
