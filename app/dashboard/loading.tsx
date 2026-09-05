import { Brand } from '@/components/smjena/shared';

export default function DashboardLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-[#f6f7f9] text-[#101827]" aria-busy="true" aria-label="Učitavanje naloga">
      <header className="border-b border-slate-200/80 bg-white/70">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand />
          <div className="size-11 animate-pulse rounded-full bg-slate-200" />
        </div>
      </header>
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-12 max-w-xl animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="h-80 animate-pulse rounded-[30px] bg-slate-200" />
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-[24px] bg-slate-200" />
            <div className="h-36 animate-pulse rounded-[24px] bg-slate-200" />
          </div>
        </div>
      </div>
      <span className="sr-only">Učitavamo tvoje stvarne podatke.</span>
    </main>
  );
}
