import Link from "next/link";

export default function OfflinePage() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1eb] p-6 text-[#101d34]">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-8 text-center shadow-xl shadow-[#101d34]/10">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[#ff5b35] text-2xl font-black text-white">S</div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#ff5b35]">Trenutno bez mreže</p>
        <h1 className="text-3xl font-black tracking-tight">SMJENA čeka vezu.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d6675]">Provjeri internet i pokušaj ponovo. Otvorena aplikacija će se automatski vratiti čim veza proradi.</p>
        <Link href="/" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#101d34] px-6 text-sm font-black text-white transition hover:bg-[#ff5b35]">Pokušaj ponovo</Link>
      </section>
    </main>
  );
}
