'use client';

export default function BillingError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl p-8">
    <h1 className="text-2xl font-bold">Pregled kredita nije dostupan</h1>
    <p className="my-4">Ne možemo potvrditi pristup ili stanje kredita. Provjeri vezu i pokušaj ponovo.</p>
    <button className="min-h-11 rounded-lg bg-slate-900 px-5 text-white" onClick={reset}>Pokušaj ponovo</button>
  </main>;
}
