'use client';
export default function NotificationError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Obavijesti nijesu dostupne</h1>
    <p className="my-4">Provjeri vezu i pokušaj ponovo. Prijave i dogovori nijesu promijenjeni.</p>
    <button className="min-h-11 rounded-lg bg-slate-900 px-5 text-white" onClick={reset}>Pokušaj ponovo</button></main>;
}
