'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="sr-Latn-ME">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f4f1eb] p-6 text-[#101d34]">
          <section className="max-w-md rounded-[28px] border border-red-200 bg-white p-8 text-center shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#ff5b35]">SMJENA</p>
            <h1 className="mt-3 text-2xl font-black">Nešto je pošlo po zlu</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Akcija nije potvrđena. Provjeri internet i pokušaj ponovo.</p>
            <button onClick={reset} className="mt-6 min-h-11 rounded-xl bg-[#101d34] px-6 text-sm font-bold text-white">Pokušaj ponovo</button>
          </section>
        </main>
      </body>
    </html>
  );
}
