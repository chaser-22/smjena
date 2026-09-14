'use client';
import Link from 'next/link';
export default function SettingsError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Nalog trenutno nije dostupan</h1><p className="my-4">Provjeri vezu i pokušaj ponovo. Nijesmo promijenili izabranu firmu.</p><button className="min-h-11 rounded-lg bg-slate-900 px-5 text-white" onClick={reset}>Pokušaj ponovo</button><Link href="/login" className="ml-4 inline-flex min-h-11 items-center underline">Prijava</Link></main>;
}
