'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Flame,
  Heart,
  MapPin,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Shift = {
  id: number;
  role: string;
  place: string;
  area: string;
  distance: string;
  time: string;
  pay: number;
  spots: string;
  urgent?: boolean;
  color: string;
};

const shifts: Shift[] = [
  {
    id: 1,
    role: 'Konobar/ica',
    place: 'Rougemarin City',
    area: 'Vukovarska, Zagreb',
    distance: '1,2 km',
    time: 'Danas · 18:00–00:00',
    pay: 84,
    spots: '1 od 2 mjesta ostalo',
    urgent: true,
    color: 'bg-[#ff5b35]',
  },
  {
    id: 2,
    role: 'Barmen/ica',
    place: 'Swanky Monkey Garden',
    area: 'Ilica, Zagreb',
    distance: '800 m',
    time: 'Sutra · 19:00–01:00',
    pay: 78,
    spots: '2 mjesta',
    color: 'bg-[#6e59db]',
  },
  {
    id: 3,
    role: 'Pomoćni kuhar/ica',
    place: 'Broom 44',
    area: 'Dolac, Zagreb',
    distance: '2,4 km',
    time: 'Subota · 10:00–17:00',
    pay: 77,
    spots: '1 mjesto',
    color: 'bg-[#16896c]',
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5" aria-label="SMJENA">
      <span className="grid size-9 place-items-center rounded-[12px] bg-[#ff5b35] text-white shadow-[0_8px_24px_rgba(255,91,53,.28)]">
        <Zap className="size-[18px] fill-current" />
      </span>
      <span className="font-display text-[19px] font-black tracking-[-0.04em]">
        SMJENA
      </span>
    </div>
  );
}

function WorkerView() {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [claimedShift, setClaimedShift] = useState<Shift | null>(null);
  const [onlyToday, setOnlyToday] = useState(false);

  const visibleShifts = onlyToday ? shifts.slice(0, 1) : shifts;

  const claimShift = () => {
    if (!selectedShift) return;
    setClaimedShift(selectedShift);
    setSelectedShift(null);
  };

  return (
    <>
      <section className="app-grid">
        <div className="min-w-0">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">UTORAK, 1. RUJNA</p>
              <h1 className="font-display mt-2 text-[clamp(2rem,5vw,3.7rem)] font-black leading-[.95] tracking-[-0.055em]">
                Bok, Luka. <span className="text-[#ff5b35]">Idemo raditi?</span>
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-slate-500">
                Tri smjene odgovaraju tvojim vještinama i dostupnosti.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setOnlyToday((value) => !value)}
              aria-pressed={onlyToday}
              className="h-10 rounded-full border-slate-200 bg-white px-4 shadow-sm"
            >
              <Clock3 /> {onlyToday ? 'Sve smjene' : 'Samo danas'}
            </Button>
          </div>

          {claimedShift ? (
            <div className="mb-5 overflow-hidden rounded-[28px] bg-[#0d1d1a] p-5 text-white shadow-[0_24px_60px_rgba(13,29,26,.18)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-4 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.13em] text-[#77f0bd]">
                    <CheckCircle2 className="size-4" /> Smjena je tvoja
                  </div>
                  <h2 className="font-display text-2xl font-black tracking-[-.04em] sm:text-3xl">
                    {claimedShift.role} · {claimedShift.place}
                  </h2>
                  <p className="mt-2 text-sm text-white/65">
                    {claimedShift.time} · {claimedShift.area}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[.1em] text-white/50">
                    Počinje za
                  </p>
                  <p className="font-display mt-1 text-xl font-black">4h 21m</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                <Button className="h-11 rounded-xl bg-[#77f0bd] px-5 font-bold text-[#0d1d1a] hover:bg-[#96f5cc]">
                  <QrCode /> Otvori check-in
                </Button>
                <span className="text-xs text-white/50">
                  Budi tamo 10 min ranije. Sretno!
                </span>
              </div>
            </div>
          ) : (
            <FeaturedShift shift={shifts[0]} onClaim={() => setSelectedShift(shifts[0])} />
          )}

          <div className="mb-4 mt-9 flex items-center justify-between">
            <div>
              <p className="eyebrow">BLIZU TEBE</p>
              <h2 className="font-display mt-1 text-2xl font-black tracking-[-.04em]">
                Otvorene smjene
              </h2>
            </div>
            <button className="flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-slate-900">
              Prikaži sve <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="space-y-3">
            {visibleShifts.slice(claimedShift ? 0 : 1).map((shift) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                onClaim={() => setSelectedShift(shift)}
              />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] bg-[#101d34] p-5 text-white shadow-[0_20px_50px_rgba(16,29,52,.16)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-white/50">
                  Ovaj tjedan
                </p>
                <p className="font-display mt-2 text-4xl font-black tracking-[-.05em]">
                  €218
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-white/10">
                <WalletCards className="size-5 text-[#ff9b83]" />
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
              <span className="text-white/50">3 završene smjene</span>
              <span className="font-bold text-[#77f0bd]">+ €64 vs. prošli tjedan</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="score-ring grid size-14 place-items-center rounded-full">
                  <span className="font-display text-lg font-black">96</span>
                </div>
                <div>
                  <p className="text-sm font-bold">SMJENA score</p>
                  <p className="text-xs text-slate-500">Odličan profil</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-slate-300" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
              <Stat value="27" label="smjena" />
              <Stat value="4,92" label="ocjena" />
              <Stat value="100%" label="dolaznost" />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#ffcfbf] bg-[#fff4ef] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#ff5b35] text-white">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-extrabold">Još samo 1 smjena</p>
                <p className="mt-1 text-xs leading-5 text-[#8c4a38]">
                  Završi je bez kašnjenja i otključaj premium barmen smjene od €13/h.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <Dialog open={Boolean(selectedShift)} onOpenChange={(open) => !open && setSelectedShift(null)}>
        <DialogContent className="max-w-md rounded-[24px] p-0 sm:max-w-md">
          <div className="p-6 pb-4">
            <DialogHeader>
              <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#ff5b35]">
                <Zap className="size-5 fill-current" />
              </div>
              <DialogTitle className="font-display text-2xl font-black tracking-[-.04em]">
                Uzimaš ovu smjenu?
              </DialogTitle>
              <DialogDescription className="leading-5">
                Nema prijave ni čekanja. Potvrdom se obvezuješ doći na vrijeme.
              </DialogDescription>
            </DialogHeader>
            {selectedShift && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-display text-lg font-black">{selectedShift.role}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedShift.place}</p>
                  </div>
                  <p className="font-display text-2xl font-black text-[#ff5b35]">€{selectedShift.pay}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> {selectedShift.time}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {selectedShift.distance}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="rounded-b-[24px] p-4 sm:flex-row">
            <DialogClose render={<Button variant="outline" className="h-11 rounded-xl px-5" />}>Još ne</DialogClose>
            <Button onClick={claimShift} className="h-11 flex-1 rounded-xl bg-[#ff5b35] font-extrabold hover:bg-[#e94b27]">
              <Zap className="fill-current" /> Da, uzmi smjenu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeaturedShift({ shift, onClaim }: { shift: Shift; onClaim: () => void }) {
  return (
    <article className="relative overflow-hidden rounded-[30px] bg-[#101d34] p-5 text-white shadow-[0_28px_70px_rgba(16,29,52,.2)] sm:p-7">
      <div className="absolute -right-20 -top-24 size-72 rounded-full border-[48px] border-white/[.035]" />
      <div className="relative">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Badge className="h-7 gap-1.5 rounded-full bg-[#ff5b35] px-3 text-[11px] font-extrabold uppercase tracking-[.08em]">
            <Flame className="fill-current" /> SOS smjena
          </Badge>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
            <MapPin className="size-3.5" /> {shift.distance} od tebe
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-[#ff9b83]">Počinje za 4h 21m</p>
            <h2 className="font-display mt-2 text-[clamp(2rem,5vw,3.4rem)] font-black leading-none tracking-[-.055em]">
              {shift.role}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
              <span>{shift.place} · ⭐ 4,9</span>
              <span>{shift.time}</span>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-4xl font-black tracking-[-.05em]">€{shift.pay}</p>
            <p className="mt-1 text-xs font-bold text-[#77f0bd]">+ napojnice</p>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <Button onClick={onClaim} className="h-12 min-w-52 rounded-xl bg-[#ff5b35] px-6 text-[15px] font-extrabold hover:bg-[#e94b27]">
            <Zap className="fill-current" /> UZMI SMJENU
          </Button>
          <span className="text-xs font-semibold text-white/50">{shift.spots}</span>
        </div>
      </div>
    </article>
  );
}

function ShiftRow({ shift, onClaim }: { shift: Shift; onClaim: () => void }) {
  return (
    <article className="group grid gap-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className={`hidden size-12 place-items-center rounded-2xl text-white sm:grid ${shift.color}`}>
        <BriefcaseBusiness className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display truncate text-lg font-black tracking-[-.025em]">{shift.role}</h3>
          <span className="shrink-0 text-xs font-bold text-emerald-700">⭐ 4,9</span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{shift.place} · {shift.area}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-slate-400" /> {shift.time}</span>
          <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-slate-400" /> {shift.distance}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
        <div>
          <p className="font-display text-2xl font-black tracking-[-.04em]">€{shift.pay}</p>
          <p className="text-[11px] font-semibold text-slate-400">{shift.spots}</p>
        </div>
        <Button onClick={onClaim} variant="outline" className="mt-2 h-9 rounded-xl px-4 font-bold group-hover:border-[#ffb6a4] group-hover:text-[#e94b27]">
          Uzmi
        </Button>
      </div>
    </article>
  );
}

function EmployerView() {
  const [postOpen, setPostOpen] = useState(false);
  const [posted, setPosted] = useState(false);

  const publish = () => {
    setPosted(true);
    setPostOpen(false);
  };

  return (
    <>
      <section className="app-grid">
        <div className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">ROUGEMARIN CITY · ZAGREB</p>
              <h1 className="font-display mt-2 text-[clamp(2rem,5vw,3.7rem)] font-black leading-[.95] tracking-[-0.055em]">
                Fali ti <span className="text-[#ff5b35]">čovjek?</span>
              </h1>
              <p className="mt-3 text-[15px] text-slate-500">Objavi smjenu. Pouzdani ljudi su već blizu.</p>
            </div>
            <Button onClick={() => setPostOpen(true)} className="h-12 rounded-xl bg-[#ff5b35] px-5 text-sm font-extrabold shadow-[0_10px_30px_rgba(255,91,53,.22)] hover:bg-[#e94b27]">
              <Plus /> NOVA SMJENA
            </Button>
          </div>

          {posted && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <div><p className="text-sm font-extrabold">Smjena je objavljena</p><p className="text-xs text-emerald-700">Obavijestili smo 38 provjerenih konobara u blizini.</p></div>
              </div>
              <button onClick={() => setPosted(false)} className="text-xs font-bold text-emerald-700">U redu</button>
            </div>
          )}

          <div className="overflow-hidden rounded-[30px] bg-[#101d34] text-white shadow-[0_28px_70px_rgba(16,29,52,.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#ff9b83]"><Zap className="size-3.5 fill-current" /> Aktivna SOS smjena</div>
                <h2 className="font-display mt-3 text-3xl font-black tracking-[-.05em]">Konobar/ica · večeras</h2>
                <p className="mt-2 text-sm text-white/55">18:00–00:00 · €84 + napojnice · 2 osobe</p>
              </div>
              <div className="rounded-2xl bg-white/[.07] px-5 py-4 text-center">
                <p className="font-display text-3xl font-black text-[#77f0bd]">1 / 2</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[.1em] text-white/45">mjesta popunjeno</p>
              </div>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              <DarkStat icon={<Clock3 />} value="2m 14s" label="vrijeme do prve prijave" />
              <DarkStat icon={<Users />} value="38" label="obaviještenih radnika" />
              <DarkStat icon={<Zap />} value="SOS +€15" label="aktivni dodatak" />
            </div>
          </div>

          <div className="mb-4 mt-9 flex items-center justify-between">
            <div><p className="eyebrow">DANAS</p><h2 className="font-display mt-1 text-2xl font-black tracking-[-.04em]">Tvoje smjene</h2></div>
            <button className="text-sm font-bold text-slate-500">Povijest</button>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="size-5" /></span>
                <div><p className="font-display text-lg font-black">Pomoćni kuhar/ica</p><p className="text-xs text-slate-500">12:00–18:00 · Popunjeno za 4m 38s</p></div>
              </div>
              <div className="flex -space-x-2"><Avatar initials="IM" color="bg-[#6e59db]" /><Avatar initials="NK" color="bg-[#16896c]" /><span className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-bold">+1</span></div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-extrabold">Brzina popunjavanja</p><Zap className="size-4 text-[#ff5b35]" /></div>
            <p className="font-display mt-4 text-4xl font-black tracking-[-.05em]">4m 38s</p>
            <p className="mt-1 text-xs text-slate-500">medijan zadnjih 30 dana</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[78%] rounded-full bg-[#ff5b35]" /></div>
            <p className="mt-2 text-[11px] font-bold text-emerald-700">22% brže nego prošli mjesec</p>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">Moji ljudi</p><p className="mt-1 text-xs text-slate-500">23 provjerena radnika</p></div><Heart className="size-5 fill-[#ffebe5] text-[#ff5b35]" /></div>
            <div className="mt-5 flex items-center justify-between"><div className="flex -space-x-2"><Avatar initials="IM" color="bg-[#6e59db]" /><Avatar initials="AJ" color="bg-[#ff8a59]" /><Avatar initials="NK" color="bg-[#16896c]" /><Avatar initials="+20" color="bg-slate-700" /></div><ChevronRight className="size-5 text-slate-300" /></div>
            <Button variant="outline" className="mt-5 h-10 w-full rounded-xl font-bold"><Users /> Pošalji smjenu ekipi</Button>
          </div>
          <div className="rounded-[24px] border border-[#d6d7ff] bg-[#f1f0ff] p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#6e59db]" /><div><p className="text-sm font-extrabold">Zamjena zagarantirana</p><p className="mt-1 text-xs leading-5 text-[#4e4790]">Ako radnik otkaže, SOS mreža odmah traži zamjenu.</p></div></div>
          </div>
        </aside>
      </section>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] p-0 sm:max-w-xl">
          <div className="p-6 pb-3">
            <DialogHeader>
              <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#ff5b35]"><Zap className="size-5 fill-current" /></div>
              <DialogTitle className="font-display text-2xl font-black tracking-[-.04em]">Nova smjena</DialogTitle>
              <DialogDescription>Objavi hitnu smjenu za manje od 30 sekundi.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="mt-5 gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="role">Uloga</FieldLabel><Select defaultValue="konobar"><SelectTrigger id="role" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="konobar">Konobar/ica</SelectItem><SelectItem value="barmen">Barmen/ica</SelectItem><SelectItem value="kuhar">Pomoćni kuhar/ica</SelectItem><SelectItem value="cistac">Čistač/ica</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel htmlFor="people">Broj ljudi</FieldLabel><Input id="people" type="number" defaultValue="2" min="1" className="h-11 rounded-xl" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="start">Početak</FieldLabel><Input id="start" type="datetime-local" defaultValue="2026-09-01T18:00" className="h-11 rounded-xl" /></Field>
                <Field><FieldLabel htmlFor="end">Završetak</FieldLabel><Input id="end" type="time" defaultValue="00:00" className="h-11 rounded-xl" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="pay">Isplata po osobi (€)</FieldLabel><Input id="pay" type="number" defaultValue="84" className="h-11 rounded-xl" /></Field>
                <Field><FieldLabel htmlFor="location">Lokacija</FieldLabel><Input id="location" defaultValue="Vukovarska 63, Zagreb" className="h-11 rounded-xl" /></Field>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#ffcfbf] bg-[#fff7f3] p-4">
                <div className="flex items-start gap-3"><Flame className="mt-0.5 size-5 fill-[#ff5b35] text-[#ff5b35]" /><div><p className="text-sm font-extrabold">SOS smjena</p><p className="mt-1 text-xs text-[#8c4a38]">Prioritetna obavijest radnicima unutar 5 km · +€15</p></div></div>
                <input type="checkbox" defaultChecked className="size-5 accent-[#ff5b35]" aria-label="Označi kao SOS smjenu" />
              </label>
            </FieldGroup>
          </div>
          <DialogFooter className="rounded-b-[24px] p-4"><DialogClose render={<Button variant="outline" className="h-11 rounded-xl px-5" />}>Odustani</DialogClose><Button onClick={publish} className="h-11 flex-1 rounded-xl bg-[#ff5b35] font-extrabold hover:bg-[#e94b27]"><Zap className="fill-current" /> Objavi smjenu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DarkStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="flex items-center gap-3 bg-white/[.035] p-5"><span className="text-[#ff9b83] [&_svg]:size-4">{icon}</span><div><p className="text-sm font-extrabold">{value}</p><p className="text-[10px] text-white/40">{label}</p></div></div>;
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return <span className={`grid size-9 place-items-center rounded-full border-2 border-white text-[10px] font-extrabold text-white ${color}`}>{initials}</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div><p className="font-display text-base font-black">{value}</p><p className="mt-0.5 text-[10px] text-slate-400">{label}</p></div>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#101827]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f7f9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex"><MapPin className="size-3.5" /> Zagreb · 5 km</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Obavijesti"><Bell /><span className="absolute right-2 top-1.5 size-2 rounded-full border-2 border-[#f6f7f9] bg-[#ff5b35]" /></Button>
            <span className="grid size-9 place-items-center rounded-full bg-[#101d34] text-xs font-extrabold text-white">LK</span>
          </div>
        </div>
      </header>

      <Tabs defaultValue="worker" className="mx-auto max-w-[1240px] gap-0 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center py-5">
          <TabsList className="h-10 rounded-full bg-slate-200/70 p-1">
            <TabsTrigger value="worker" className="h-8 min-w-32 rounded-full px-5 font-bold data-active:shadow-sm"><CircleUserRound /> Tražim smjenu</TabsTrigger>
            <TabsTrigger value="employer" className="h-8 min-w-32 rounded-full px-5 font-bold data-active:shadow-sm"><BriefcaseBusiness /> Trebam radnika</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="worker"><WorkerView /></TabsContent>
        <TabsContent value="employer"><EmployerView /></TabsContent>
      </Tabs>

      <nav className="mobile-nav" aria-label="Glavna navigacija">
        <button><Search /><span>Smjene</span></button>
        <button><BriefcaseBusiness /><span>Moje</span></button>
        <button><WalletCards /><span>Zarada</span></button>
        <button><CircleUserRound /><span>Profil</span></button>
      </nav>
    </main>
  );
}
