'use client';

import { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Crown,
  Heart,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
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
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import {
  openShifts,
  type Shift,
  type SmjenaState,
} from '@/lib/smjena';
import { Avatar, Metric, ShiftCard } from '@/components/smjena/shared';

type WorkerDashboardProps = {
  state: SmjenaState;
  onClaim: (id: string) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onCancel: (id: string) => void;
  onAvailability: (available: boolean) => void;
  onNotifications: (enabled: boolean, subscription?: PushSubscriptionJSON) => void;
  onDismissReward: () => void;
  onReset: () => void;
};

export function WorkerDashboard({
  state,
  onClaim,
  onCheckIn,
  onCheckOut,
  onCancel,
  onAvailability,
  onNotifications,
  onDismissReward,
  onReset,
}: WorkerDashboardProps) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [onlyToday, setOnlyToday] = useState(false);

  const activeShift = state.shifts.find((shift) => shift.id === state.activeShiftId) ?? null;
  const availableShifts = useMemo(() => {
    const available = openShifts(state).filter((shift) => shift.id !== state.activeShiftId);
    return onlyToday ? available.filter((shift) => shift.dayLabel === 'Danas') : available;
  }, [onlyToday, state]);
  const featured = availableShifts.find((shift) => shift.urgent) ?? availableShifts[0];
  const otherShifts = availableShifts.filter((shift) => shift.id !== featured?.id);
  const weeklyGoal = 350;

  const confirmClaim = () => {
    if (!selectedShift) return;
    onClaim(selectedShift.id);
    setSelectedShift(null);
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.add({ title: 'Obavijesti nijesu dostupne', description: 'Ovaj preglednik ne podržava obavijesti.', type: 'warning' });
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      toast.add({ title: 'Obavijesti još nijesu konfigurisane', description: 'Nedostaje javni VAPID ključ na serveru.', type: 'warning' });
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    let subscription: PushSubscriptionJSON | undefined;
    if (enabled) {
      const registration = await navigator.serviceWorker.getRegistration() ?? await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      const existing = await registration.pushManager.getSubscription();
      const pushSubscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      subscription = pushSubscription.toJSON();
    }
    onNotifications(enabled, subscription);
    toast.add({
      title: enabled ? 'SOS obavijesti uključene' : 'Obavijesti nijesu uključene',
      description: enabled ? 'Javićemo ti kada se pojavi vrijedna smjena u blizini.' : 'Možeš ih uključiti kasnije u postavkama preglednika.',
      type: enabled ? 'success' : 'warning',
    });
  };

  return (
    <>
      <section className="app-grid">
        <div className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">DANAS · CRNA GORA</p>
              <h1 className="font-display mt-2 text-[clamp(2rem,5vw,3.7rem)] font-black leading-[.95] tracking-[-0.055em]">
                Slobodan si? <span className="text-[#ff5b35]">Zaradi danas.</span>
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-slate-500">
                Verifikovane smjene. Tačna zarada. Jedan dodir do posla.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <span className={`size-2 rounded-full ${state.worker.available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-xs font-extrabold">{state.worker.available ? 'Dostupan' : 'Nedostupan'}</span>
              <Switch checked={state.worker.available} onCheckedChange={onAvailability} aria-label="Dostupan za smjene" />
            </div>
          </div>

          {state.lastReward && (
            <RewardMoment state={state} onDismiss={onDismissReward} />
          )}

          {activeShift ? (
            <ActiveShift
              shift={activeShift}
              onCheckIn={() => setCheckInOpen(true)}
              onCheckOut={() => {
                onCheckOut(activeShift.id);
              }}
              onCancel={() => setCancelOpen(true)}
            />
          ) : featured ? (
            <ShiftCard shift={featured} featured onClaim={() => setSelectedShift(featured)} />
          ) : (
            <EmptyFeed onReset={onReset} />
          )}

          <div className="mb-4 mt-9 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">U TVOJIM VJEŠTINAMA</p>
              <h2 className="font-display mt-1 text-2xl font-black tracking-[-.04em]">Smjene blizu tebe</h2>
            </div>
            <Button variant="outline" onClick={() => setOnlyToday((value) => !value)} className="h-9 rounded-full bg-white px-4 font-bold">
              <Clock3 /> {onlyToday ? 'Sve smjene' : 'Samo danas'}
            </Button>
          </div>

          <div className="space-y-3">
            {otherShifts.length > 0 ? otherShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} disabled={Boolean(activeShift)} onClaim={() => setSelectedShift(shift)} />
            )) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/60 p-7 text-center">
                <CalendarCheck className="mx-auto size-6 text-slate-400" />
                <p className="mt-3 text-sm font-extrabold">Nema još drugih smjena za ovaj filter</p>
                <p className="mt-1 text-xs text-slate-500">Uključi obavijesti i javićemo ti kada se pojavi nova.</p>
              </div>
            )}
          </div>

          <section className="mt-9 grid gap-4 md:grid-cols-3" aria-label="Zašto raditi preko SMJENE">
            <TrustCard icon={<ShieldCheck />} title="Verifikovan posao" copy="Poslodavac, lokacija i uslovi su provjereni prije objave." />
            <TrustCard icon={<CircleDollarSign />} title="Zarada unaprijed" copy="Tačno znaš koliko zarađuješ i kada stiže isplata." />
            <TrustCard icon={<Trophy />} title="Rad gradi reputaciju" copy="Dolaznost i ocjene otključavaju bolje plaćene smjene." />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] bg-[#101d34] p-5 text-white shadow-[0_20px_50px_rgba(16,29,52,.16)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-white/50">Ove sedmice</p>
                <p className="font-display mt-2 text-4xl font-black tracking-[-.05em]">€{state.worker.earningsWeek}</p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-white/10"><WalletCards className="size-5 text-[#ff9b83]" /></span>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-[10px] font-bold text-white/45"><span>CILJ €{weeklyGoal}</span><span>{Math.round((state.worker.earningsWeek / weeklyGoal) * 100)}%</span></div>
              <Progress value={(state.worker.earningsWeek / weeklyGoal) * 100} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#77f0bd]" />
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
              <span className="text-white/50">{state.worker.completedShifts} ukupno</span>
              <span className="font-bold text-[#77f0bd]">+ €{state.worker.earningsWeek - state.worker.previousWeek} ove sedmice</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="score-ring grid size-14 place-items-center rounded-full" style={{ '--score': `${state.worker.score}%` } as React.CSSProperties}>
                  <span className="font-display text-lg font-black">{state.worker.score}</span>
                </div>
                <div><p className="text-sm font-bold">SMJENA Score</p><p className="text-xs text-slate-500">{state.worker.score >= 95 ? 'Odličan profil' : 'Pouzdan profil'}</p></div>
              </div>
              <ChevronRight className="size-5 text-slate-300" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
              <Metric value={String(state.worker.completedShifts)} label="smjena" />
              <Metric value={state.worker.rating.toFixed(2)} label="ocjena" />
              <Metric value={`${state.worker.attendance}%`} label="dolaznost" />
            </div>
          </div>

          <div className={`rounded-[24px] border p-5 ${state.worker.premiumUnlocked ? 'border-[#d6d7ff] bg-[#f1f0ff]' : 'border-[#ffcfbf] bg-[#fff4ef]'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-white ${state.worker.premiumUnlocked ? 'bg-[#6e59db]' : 'bg-[#ff5b35]'}`}>
                {state.worker.premiumUnlocked ? <Crown className="size-4" /> : <Sparkles className="size-4" />}
              </span>
              <div>
                <p className="text-sm font-extrabold">{state.worker.premiumUnlocked ? 'Premium smjene otključane' : 'Još samo 1 dobra smjena'}</p>
                <p className={`mt-1 text-xs leading-5 ${state.worker.premiumUnlocked ? 'text-[#4e4790]' : 'text-[#8c4a38]'}`}>
                  {state.worker.premiumUnlocked ? 'Sada vidiš barmen smjene od €13/h prije ostalih radnika.' : 'Završi je bez kašnjenja i otključaj premium smjene.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">Tvoje ekipe</p><p className="mt-1 text-xs text-slate-500">{state.worker.crewEmployers.length} poslodavca te žele nazad</p></div><Heart className="size-5 fill-[#ffebe5] text-[#ff5b35]" /></div>
            <div className="mt-4 flex items-center justify-between"><div className="flex -space-x-2"><Avatar initials="PB" color="bg-[#6e59db]" /><Avatar initials="TS" color="bg-[#16896c]" /><Avatar initials="BK" color="bg-[#ff8a59]" /></div><Badge variant="secondary">Prvi pristup</Badge></div>
          </div>

          {!state.worker.notificationsEnabled && (
            <button onClick={enableNotifications} className="w-full rounded-[24px] border border-[#d6d7ff] bg-[#f1f0ff] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm">
              <div className="flex items-start gap-3"><BellRing className="mt-0.5 size-5 shrink-0 text-[#6e59db]" /><div><p className="text-sm font-extrabold">Ne propusti SOS smjenu</p><p className="mt-1 text-xs leading-5 text-[#4e4790]">Uključi obavijesti za vrijedne smjene blizu tebe.</p></div></div>
            </button>
          )}
        </aside>
      </section>

      <Dialog open={Boolean(selectedShift)} onOpenChange={(open) => !open && setSelectedShift(null)}>
        <DialogContent className="max-w-md rounded-[24px] p-0 sm:max-w-md">
          <div className="p-6 pb-4">
            <DialogHeader>
              <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#ff5b35]"><Zap className="size-5 fill-current" /></div>
              <DialogTitle className="font-display text-2xl font-black tracking-[-.04em]">Uzimaš ovu smjenu?</DialogTitle>
              <DialogDescription className="leading-5">Nema prijave ni čekanja. Potvrdom se obavezuješ da dođeš na vrijeme.</DialogDescription>
            </DialogHeader>
            {selectedShift && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4"><div><p className="font-display text-lg font-black">{selectedShift.role}</p><p className="mt-1 text-xs text-slate-500">{selectedShift.employer} · {selectedShift.area}</p></div><p className="font-display text-2xl font-black text-[#ff5b35]">€{selectedShift.pay}</p></div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> {selectedShift.dayLabel} · {selectedShift.start}–{selectedShift.end}</span><span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {selectedShift.distance}</span></div>
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><ShieldCheck className="mr-1.5 inline size-4" /> Tvoj profil već ispunjava sve uslove.</div>
              </div>
            )}
          </div>
          <DialogFooter className="rounded-b-[24px] p-4 sm:flex-row"><DialogClose render={<Button variant="outline" className="h-11 rounded-xl px-5" />}>Još ne</DialogClose><Button onClick={confirmClaim} className="h-11 flex-1 rounded-xl bg-[#ff5b35] font-extrabold hover:bg-[#e94b27]"><Zap className="fill-current" /> UZMI ODMAH</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="max-w-sm rounded-[24px] text-center">
          <DialogHeader className="items-center"><div className="grid size-20 place-items-center rounded-[24px] bg-[#101d34] text-white"><QrCode className="size-11" /></div><DialogTitle className="font-display mt-2 text-2xl font-black">Check-in kod</DialogTitle><DialogDescription>Pokaži kod voditelju smjene ili potvrdi dolazak na lokaciji.</DialogDescription></DialogHeader>
          <div className="rounded-2xl bg-slate-50 p-4 text-left text-xs text-slate-600"><p className="font-extrabold text-slate-900">Zaštićen check-in</p><p className="mt-1">Evidentira dolazak, početak obračuna i štiti obje strane.</p></div>
          <Button onClick={() => { if (activeShift) onCheckIn(activeShift.id); setCheckInOpen(false); }} className="h-11 rounded-xl bg-[#16896c] font-extrabold hover:bg-[#11765d]"><CheckCircle2 /> Potvrdi dolazak</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-[24px] sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black">Otkazati smjenu?</DialogTitle><DialogDescription>Mjesto će odmah biti vraćeno u mrežu. Česta ili kasna otkazivanja utiču na pouzdanost.</DialogDescription></DialogHeader>
          <DialogFooter><DialogClose render={<Button variant="outline" className="h-11 rounded-xl" />}>Zadrži smjenu</DialogClose><Button variant="destructive" onClick={() => { if (activeShift) onCancel(activeShift.id); setCancelOpen(false); }} className="h-11 rounded-xl font-bold">Potvrdi otkazivanje</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function ActiveShift({ shift, onCheckIn, onCheckOut, onCancel }: { shift: Shift; onCheckIn: () => void; onCheckOut: () => void; onCancel: () => void }) {
  const inProgress = shift.status === 'in_progress';
  return (
    <article className="active-shift overflow-hidden rounded-[30px] bg-[#0d1d1a] text-white shadow-[0_28px_70px_rgba(13,29,26,.2)]">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.13em] text-[#77f0bd]"><CheckCircle2 className="size-4" /> {inProgress ? 'Smjena je u toku' : 'Smjena je tvoja'}</div>
            <h2 className="font-display text-2xl font-black tracking-[-.04em] sm:text-3xl">{shift.role} · {shift.employer}</h2>
            <p className="mt-2 text-sm text-white/60">{shift.dayLabel} · {shift.start}–{shift.end} · {shift.area}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-right"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-white/45">{inProgress ? 'Zarada' : 'Počinje za'}</p><p className="font-display mt-1 text-2xl font-black">{inProgress ? `€${shift.pay}` : shift.startsIn}</p></div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><ActiveInfo icon={<MapPin />} label="Lokacija" value={shift.area} /><ActiveInfo icon={<Clock3 />} label="Vrijeme" value={`${shift.start}–${shift.end}`} /><ActiveInfo icon={<Users />} label="Ekipa" value={`${shift.workersNeeded} radnika`} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-white/[.035] p-5 sm:px-7">
        <div className="flex flex-wrap gap-2">{inProgress ? <Button onClick={onCheckOut} className="h-11 rounded-xl bg-[#77f0bd] px-5 font-extrabold text-[#0d1d1a] hover:bg-[#96f5cc]"><CircleDollarSign /> Završi smjenu i evidentiraj €{shift.pay}</Button> : <><Button onClick={onCheckIn} className="h-11 rounded-xl bg-[#77f0bd] px-5 font-extrabold text-[#0d1d1a] hover:bg-[#96f5cc]"><QrCode /> Potvrdi dolazak</Button><Button onClick={onCancel} variant="outline" className="h-11 rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">Otkaži</Button></>}</div>
        <span className="text-xs text-white/45">{inProgress ? 'Poslodavac potvrđuje sate nakon checkouta.' : 'Dođi 10 minuta ranije. Sretno!'}</span>
      </div>
    </article>
  );
}

function RewardMoment({ state, onDismiss }: { state: SmjenaState; onDismiss: () => void }) {
  const reward = state.lastReward!;
  return (
    <section className="reward-card relative mb-5 overflow-hidden rounded-[28px] border border-[#b8ebd5] bg-[#eafff4] p-5 sm:p-6">
      <div className="absolute -right-6 -top-8 size-28 rounded-full bg-[#77f0bd]/25 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#16896c] text-white shadow-lg"><Trophy className="size-6" /></span><div><p className="eyebrow !text-emerald-700">SMJENA ZAVRŠENA</p><h2 className="font-display mt-1 text-2xl font-black tracking-[-.04em]">+€{reward.amount} zarađeno</h2><p className="mt-1 text-xs font-semibold text-emerald-800"><Star className="mb-0.5 inline size-3.5 fill-current" /> Ocjena {reward.rating.toFixed(1)} · Score {reward.oldScore} → {reward.newScore}{reward.unlocked ? ' · Premium otključan' : ''}</p></div></div>
        <Button onClick={onDismiss} variant="outline" className="rounded-xl border-emerald-200 bg-white/70 font-bold">Nastavi <ChevronRight /></Button>
      </div>
    </section>
  );
}

function ActiveInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/[.06] p-3"><span className="text-[#77f0bd] [&_svg]:size-4">{icon}</span><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-white/35">{label}</p><p className="mt-0.5 text-xs font-bold">{value}</p></div></div>;
}

function TrustCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="rounded-[20px] border border-slate-200/80 bg-white p-4"><span className="text-[#ff5b35] [&_svg]:size-5">{icon}</span><p className="mt-3 text-sm font-extrabold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div>;
}

function EmptyFeed({ onReset }: { onReset: () => void }) {
  return <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center"><Target className="mx-auto size-8 text-slate-300" /><h2 className="font-display mt-4 text-2xl font-black">Trenutno nema dostupnih smjena</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Uključi obavijesti i javićemo ti kada poslodavac objavi novu smjenu u tvojoj blizini.</p><Button onClick={onReset} variant="outline" className="mt-5 rounded-xl">Osvježi smjene</Button></div>;
}
