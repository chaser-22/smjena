'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1eb] p-6"><section className="max-w-md rounded-[28px] border border-red-200 bg-white p-8 text-center shadow-xl"><AlertTriangle className="mx-auto size-10 text-red-500" /><h1 className="mt-4 text-2xl font-black text-[#101d34]">Nijesmo mogli učitati nalog</h1><p className="mt-2 text-sm leading-6 text-slate-500">Veza sa bazom ili sesija trenutno nijesu dostupni. Provjeri internet i pokušaj ponovo.</p><Button onClick={reset} className="mt-6 h-11 rounded-xl bg-[#101d34] px-6 font-bold">Pokušaj ponovo</Button></section></main>;
}
