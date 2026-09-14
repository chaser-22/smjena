'use client';
export default function ApplicationsError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Prijave trenutno nijesu dostupne</h1><p className="my-4">Ne možemo potvrditi trenutni status. Provjeri vezu i osvježi prije novog pokušaja.</p><button className="min-h-11 rounded-lg bg-slate-900 px-5 text-white" onClick={reset}>Pokušaj ponovo</button></main>;
}
