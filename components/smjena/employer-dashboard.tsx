'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Euro,
  Flame,
  Heart,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  TimerReset,
  Users,
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  employerShifts,
  remainingSpots,
  roles,
  type NewShiftInput,
  type Shift,
  type SmjenaState,
} from '@/lib/smjena';
import { Avatar, FillProgress, Metric } from '@/components/smjena/shared';

type EmployerDashboardProps = {
  state: SmjenaState;
  onPost: (input: NewShiftInput) => string;
  onRaisePay: (id: string) => void;
  onBroadcast: (id: string) => void;
  onReplacement: (id: string) => void;
  onRate: (assignmentId: string, score: number, wantAgain: boolean) => void;
};

export function EmployerDashboard({ state, onPost, onRaisePay, onBroadcast, onReplacement, onRate }: EmployerDashboardProps) {
  const [postOpen, setPostOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const [ratingShift, setRatingShift] = useState<Shift | null>(null);
  const [templateShift, setTemplateShift] = useState<Shift | null>(null);

  const shifts = employerShifts(state);
  const activeShifts = shifts.filter((shift) => ['open', 'claimed', 'in_progress'].includes(shift.status));
  const completedShifts = shifts.filter((shift) => shift.status === 'completed');
  const primaryShift = activeShifts[0];

  const openNewShift = (template?: Shift) => {
    setTemplateShift(template ?? null);
    setPostOpen(true);
  };

  const handlePost = (input: NewShiftInput) => {
    onPost(input);
    setPostOpen(false);
  };

  return (
    <>
      <section className="app-grid">
        <div className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{state.employer.name.toUpperCase()} · {state.employer.city.toUpperCase()}</p>
              <h1 className="font-display mt-2 text-[clamp(2rem,5vw,3.7rem)] font-black leading-[.95] tracking-[-0.055em]">
                Fali ti <span className="text-[#ff5b35]">čovjek?</span>
              </h1>
              <p className="mt-3 text-[15px] text-slate-500">Objavi smjenu. Pouzdani ljudi su već blizu.</p>
            </div>
            <Button onClick={() => openNewShift()} className="h-12 rounded-xl bg-[#ff5b35] px-5 text-sm font-extrabold shadow-[0_10px_30px_rgba(255,91,53,.22)] hover:bg-[#e94b27]"><Plus /> NOVA SMJENA</Button>
          </div>

          {primaryShift ? (
            <EmployerHero
              shift={primaryShift}
              onRaisePay={() => {
                onRaisePay(primaryShift.id);
              }}
              onBroadcast={() => {
                onBroadcast(primaryShift.id);
              }}
              onReplacement={() => {
                onReplacement(primaryShift.id);
              }}
            />
          ) : (
            <NoActiveShift onPost={() => openNewShift()} />
          )}

          <div className="mb-4 mt-9 flex items-center justify-between gap-4">
            <div><p className="eyebrow">OPERATIVA DANAS</p><h2 className="font-display mt-1 text-2xl font-black tracking-[-.04em]">Tvoje smjene</h2></div>
            <Badge variant="outline" className="h-7 rounded-full bg-white px-3">{activeShifts.length} aktivna · {completedShifts.length} završena</Badge>
          </div>
          <div className="space-y-3">
            {shifts.map((shift) => (
              <EmployerShiftRow key={shift.id} shift={shift} onTemplate={() => openNewShift(shift)} onRate={() => setRatingShift(shift)} />
            ))}
          </div>

          <section className="mt-9 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="eyebrow">PAMETNI REDOSLJED</p><h2 className="font-display mt-1 text-xl font-black tracking-[-.035em]">Ekipa prvo. Mreža zatim. SOS na kraju.</h2></div>
              <TimerReset className="size-6 text-[#ff5b35]" />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <FlowStep number="01" title="Moji ljudi" copy={`${state.employer.crewCount} provjerenih radnika dobijaju prvi pristup.`} active />
              <FlowStep number="02" title="Javna mreža" copy="Ako ekipa ne popuni smjenu, objavi je svim dostupnim radnicima." />
              <FlowStep number="03" title="SOS cijena" copy="Povećaj ponudu dok tržište ne popuni smjenu." />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-extrabold">Brzina popunjavanja</p><Zap className="size-4 text-[#ff5b35]" /></div>
            <p className="font-display mt-4 text-4xl font-black tracking-[-.05em]">{state.employer.fillMedianMinutes === null ? '—' : `${state.employer.fillMedianMinutes}m`}</p>
            <p className="mt-1 text-xs text-slate-500">medijan stvarno popunjenih smjena</p>
            <Progress value={state.employer.fillRate ?? 0} className="mt-5 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-indicator]]:bg-[#ff5b35]" />
            <p className="mt-2 text-[11px] font-bold text-slate-500">{state.employer.fillRate === null ? 'Još nema dovoljno podataka' : `${state.employer.fillRate}% smjena popunjeno`}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">Moji ljudi</p><p className="mt-1 text-xs text-slate-500">{state.employer.crewCount} provjerena radnika</p></div><Heart className="size-5 fill-[#ffebe5] text-[#ff5b35]" /></div>
            <div className="mt-5 flex items-center justify-between"><div className="flex -space-x-2">{state.employer.crewWorkers.slice(0, 3).map((worker, index) => <Avatar key={worker.id} initials={worker.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')} color={['bg-[#6e59db]', 'bg-[#ff8a59]', 'bg-[#16896c]'][index]} />)}{state.employer.crewCount > 3 && <Avatar initials={`+${state.employer.crewCount - 3}`} color="bg-slate-700" />}</div><ChevronRight className="size-5 text-slate-300" /></div>
            <Button onClick={() => setCrewOpen(true)} variant="outline" className="mt-5 h-10 w-full rounded-xl font-bold"><Users /> Otvori ekipu</Button>
          </div>

          <div className="rounded-[24px] border border-[#d6d7ff] bg-[#f1f0ff] p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#6e59db]" /><div><p className="text-sm font-extrabold">Brza potraga za zamjenom</p><p className="mt-1 text-xs leading-5 text-[#4e4790]">Kada se mjesto oslobodi, aktiviraj SOS potragu u javnoj mreži.</p></div></div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-extrabold">Pouzdanost mreže</p><BarChart3 className="size-4 text-[#16896c]" /></div>
            <div className="mt-5 grid grid-cols-2 gap-4"><Metric value={metricPercent(state.employer.attendancePercent)} label="dolaznost" /><Metric value={metricPercent(state.employer.repeatRate)} label="ponovni radnici" /><Metric value={metricPercent(state.employer.fillRate)} label="smjena popunjeno" /><Metric value={metricPercent(state.employer.cancellationRate)} label="otkazivanja" /></div>
          </div>
        </aside>
      </section>

      <PostShiftDialog key={`${templateShift?.id ?? 'new'}-${postOpen}`} open={postOpen} onOpenChange={setPostOpen} template={templateShift} onPost={handlePost} />
      <CrewDialog open={crewOpen} onOpenChange={setCrewOpen} workers={state.employer.crewWorkers} />
      <RatingDialog key={ratingShift?.id ?? 'closed'} shift={ratingShift} onOpenChange={(open) => !open && setRatingShift(null)} onRate={onRate} />
    </>
  );
}

function EmployerHero({ shift, onRaisePay, onBroadcast, onReplacement }: { shift: Shift; onRaisePay: () => void; onBroadcast: () => void; onReplacement: () => void }) {
  const full = remainingSpots(shift) === 0;
  return (
    <article className="overflow-hidden rounded-[30px] bg-[#101d34] text-white shadow-[0_28px_70px_rgba(16,29,52,.2)]">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#ff9b83]"><Zap className="size-3.5 fill-current" /> {shift.urgent ? 'Aktivna SOS smjena' : 'Aktivna smjena'}{shift.replacementActive && <Badge className="ml-1 bg-[#ff5b35] text-white">Zamjena aktivna</Badge>}</div>
            <h2 className="font-display mt-3 text-3xl font-black tracking-[-.05em]">{shift.role} · {shift.dayLabel.toLowerCase()}</h2>
            <p className="mt-2 text-sm text-white/55">{shift.start}–{shift.end} · €{shift.pay} {shift.tips ? '+ napojnice' : ''} · {shift.workersNeeded} {shift.workersNeeded === 1 ? 'osoba' : 'osobe'}</p>
          </div>
          <div className="rounded-2xl bg-white/[.07] px-5 py-4 text-center"><p className="font-display text-3xl font-black text-[#77f0bd]">{shift.claimedWorkers.length} / {shift.workersNeeded}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-white/45">mjesta popunjeno</p></div>
        </div>
        <div className="mt-6"><FillProgress shift={shift} /></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><HeroMetric icon={<Clock3 />} value={shift.fillTime ?? '2m 14s'} label="vrijeme do prvog claim-a" /><HeroMetric icon={<Users />} value={String(shift.notifiedCount)} label="obaviještenih radnika" /><HeroMetric icon={<BellRing />} value={shift.audience === 'crew' ? 'Moji ljudi' : 'Javna mreža'} label="trenutna publika" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[.035] p-4 sm:px-7">
        {!full && shift.audience === 'crew' && <Button onClick={onBroadcast} className="h-10 rounded-xl bg-white text-[#101d34] font-bold hover:bg-white/90"><BellRing /> Pošalji javnoj mreži</Button>}
        {!full && <Button onClick={onRaisePay} className="h-10 rounded-xl bg-[#ff5b35] font-bold hover:bg-[#e94b27]"><Euro /> Povećaj za €10</Button>}
        {shift.claimedWorkers.length < shift.workersNeeded && <Button onClick={onReplacement} variant="outline" className="h-10 rounded-xl border-white/15 bg-white/[.04] font-bold text-white hover:bg-white/10 hover:text-white"><RefreshCw /> Traži zamjenu</Button>}
        {full && <span className="flex items-center gap-2 text-sm font-extrabold text-[#77f0bd]"><CheckCircle2 className="size-5" /> Smjena je spremna</span>}
      </div>
    </article>
  );
}

function EmployerShiftRow({ shift, onTemplate, onRate }: { shift: Shift; onTemplate: () => void; onRate: () => void }) {
  const completed = shift.status === 'completed';
  return (
    <article className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${completed ? 'bg-emerald-100 text-emerald-700' : shift.urgent ? 'bg-[#fff0eb] text-[#ff5b35]' : 'bg-slate-100 text-slate-600'}`}>{completed ? <Check className="size-5" /> : shift.urgent ? <Zap className="size-5 fill-current" /> : <Clock3 className="size-5" />}</span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-display truncate text-lg font-black">{shift.role}</p>{shift.replacementActive && <Badge className="bg-[#fff0eb] text-[#e94b27]">Traži zamjenu</Badge>}</div><p className="mt-1 text-xs text-slate-500">{shift.dayLabel} · {shift.start}–{shift.end} · {completed ? (shift.fillTime ? `Popunjeno za ${shift.fillTime}` : 'Završena') : `${shift.claimedWorkers.length}/${shift.workersNeeded} popunjeno`}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {shift.claimedWorkers.length > 0 && <div className="mr-1 hidden -space-x-2 sm:flex">{shift.claimedWorkers.slice(0, 3).map((worker, index) => <Avatar key={worker} initials={worker.split(' ').map((part) => part[0]).join('')} color={['bg-[#6e59db]', 'bg-[#16896c]', 'bg-[#ff8a59]'][index]} />)}</div>}
          {completed && shift.assignments?.some((assignment) => assignment.status === 'completed') && <Button onClick={onRate} variant="outline" className="h-9 rounded-xl font-bold"><Star /> Ocijeni</Button>}
          <Button onClick={onTemplate} variant="outline" className="h-9 rounded-xl font-bold"><Copy /> Ponovi</Button>
        </div>
      </div>
    </article>
  );
}

function PostShiftDialog({ open, onOpenChange, template, onPost }: { open: boolean; onOpenChange: (open: boolean) => void; template: Shift | null; onPost: (input: NewShiftInput) => void }) {
  const [role, setRole] = useState(template?.role ?? roles[0]);
  const [urgent, setUrgent] = useState(template?.urgent ?? true);
  const [crewFirst, setCrewFirst] = useState(true);

  const defaults = useMemo(() => ({
    workersNeeded: template?.workersNeeded ?? 2,
    start: template?.start ?? '18:00',
    end: template?.end ?? '00:00',
    pay: template?.pay ?? 84,
    area: template?.area ?? 'Stari grad, Budva',
    date: template?.startsAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  }), [template]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onPost({
      role,
      workersNeeded: Number(data.get('workersNeeded')),
      start: String(data.get('start')),
      end: String(data.get('end')),
      pay: Number(data.get('pay')),
      area: String(data.get('area')),
      date: String(data.get('date')),
      urgent,
      crewFirst,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[24px] p-0 sm:max-w-xl">
        <form key={template?.id ?? 'new'} onSubmit={submit}>
          <div className="p-6 pb-3">
            <DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#ff5b35]"><Zap className="size-5 fill-current" /></div><DialogTitle className="font-display text-2xl font-black tracking-[-.04em]">{template ? 'Ponovi smjenu' : 'Nova smjena'}</DialogTitle><DialogDescription>Objavi tačnu potrebu za manje od 30 sekundi. Bez oglasa i CV-a.</DialogDescription></DialogHeader>
            <FieldGroup className="mt-5 gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="role">Uloga</FieldLabel><Select value={role} onValueChange={(value) => value && setRole(value)}><SelectTrigger id="role" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
                <Field><FieldLabel htmlFor="workersNeeded">Broj ljudi</FieldLabel><Input id="workersNeeded" name="workersNeeded" type="number" defaultValue={defaults.workersNeeded} min="1" max="20" className="h-11 rounded-xl" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="date">Datum</FieldLabel><Input id="date" name="date" type="date" defaultValue={defaults.date} required className="h-11 rounded-xl" /></Field><Field><FieldLabel htmlFor="start">Početak</FieldLabel><Input id="start" name="start" type="time" defaultValue={defaults.start} required className="h-11 rounded-xl" /></Field><Field><FieldLabel htmlFor="end">Završetak</FieldLabel><Input id="end" name="end" type="time" defaultValue={defaults.end} required className="h-11 rounded-xl" /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="pay">Isplata po osobi (€)</FieldLabel><Input id="pay" name="pay" type="number" defaultValue={defaults.pay} min="20" required className="h-11 rounded-xl" /></Field><Field><FieldLabel htmlFor="area">Lokacija</FieldLabel><Input id="area" name="area" defaultValue={defaults.area} required className="h-11 rounded-xl" /></Field></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#d6d7ff] bg-[#f7f6ff] p-4"><div className="flex items-start gap-3"><Users className="mt-0.5 size-5 text-[#6e59db]" /><div><p className="text-sm font-extrabold">Prvo pošalji Mojim ljudima</p><p className="mt-1 text-xs text-[#4e4790]">Javnu mrežu možeš uključiti jednim klikom ako treba još ljudi.</p></div></div><Switch checked={crewFirst} onCheckedChange={setCrewFirst} aria-label="Prvo pošalji Mojim ljudima" /></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#ffcfbf] bg-[#fff7f3] p-4"><div className="flex items-start gap-3"><Flame className="mt-0.5 size-5 fill-[#ff5b35] text-[#ff5b35]" /><div><p className="text-sm font-extrabold">SOS smjena</p><p className="mt-1 text-xs text-[#8c4a38]">Prioritetna obavijest radnicima u blizini · dodatak uračunat.</p></div></div><Switch checked={urgent} onCheckedChange={setUrgent} aria-label="Označi kao SOS smjenu" /></div>
            </FieldGroup>
          </div>
          <DialogFooter className="rounded-b-[24px] p-4"><DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-xl px-5" />}>Odustani</DialogClose><Button type="submit" className="h-11 flex-1 rounded-xl bg-[#ff5b35] font-extrabold hover:bg-[#e94b27]"><Zap className="fill-current" /> Objavi smjenu</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CrewDialog({ open, onOpenChange, workers }: { open: boolean; onOpenChange: (open: boolean) => void; workers: SmjenaState['employer']['crewWorkers'] }) {
  const colors = ['bg-[#6e59db]', 'bg-[#ff8a59]', 'bg-[#16896c]', 'bg-[#101d34]'];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-[24px] sm:max-w-md"><DialogHeader><DialogTitle className="font-display text-2xl font-black">Moji ljudi</DialogTitle><DialogDescription>Radnici koje si ocijenio sa “želim ponovo”. Oni prvi vide tvoje smjene.</DialogDescription></DialogHeader>{workers.length ? <div className="space-y-2">{workers.map((worker, index) => <div key={worker.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"><div className="flex items-center gap-3"><Avatar initials={worker.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')} color={colors[index % colors.length]} /><div><p className="text-sm font-extrabold">{worker.name}</p><p className="text-xs text-slate-500">{worker.role} · Score {worker.score}</p></div></div><ChevronRight className="size-5 text-slate-300" /></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><Users className="mx-auto size-6 text-slate-300" /><p className="mt-3 text-sm font-bold">Još nema radnika u ekipi</p><p className="mt-1 text-xs text-slate-500">Ocijeni završen angažman i uključi “Želim ponovo”.</p></div>}</DialogContent></Dialog>;
}

function RatingDialog({ shift, onOpenChange, onRate }: { shift: Shift | null; onOpenChange: (open: boolean) => void; onRate: (assignmentId: string, score: number, wantAgain: boolean) => void }) {
  const assignments = shift?.assignments?.filter((assignment) => assignment.status === 'completed') ?? [];
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? '');
  const [rating, setRating] = useState(5);
  const [wantAgain, setWantAgain] = useState(true);
  return <Dialog open={Boolean(shift)} onOpenChange={onOpenChange}><DialogContent className="rounded-[24px] text-center sm:max-w-sm"><DialogHeader className="items-center"><div className="grid size-12 place-items-center rounded-2xl bg-[#fff6da] text-[#d99400]"><Star className="size-6 fill-current" /></div><DialogTitle className="font-display mt-2 text-2xl font-black">Kako je radnik odradio?</DialogTitle><DialogDescription>Tvoja ocjena gradi pouzdanost cijele mreže.</DialogDescription></DialogHeader>{assignments.length > 1 && <div className="flex flex-wrap justify-center gap-2">{assignments.map((assignment) => <button key={assignment.id} onClick={() => setAssignmentId(assignment.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${assignmentId === assignment.id ? 'bg-[#101d34] text-white' : 'bg-slate-100 text-slate-600'}`}>{assignment.workerName}</button>)}</div>}<p className="text-sm font-extrabold">{assignments.find((assignment) => assignment.id === assignmentId)?.workerName}</p><div className="flex justify-center gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setRating(value)} aria-label={`${value} zvjezdica`} className="p-1"><Star className={`size-8 ${value <= rating ? 'fill-[#ffbd3f] text-[#ffbd3f]' : 'text-slate-200'}`} /></button>)}</div><div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-left"><div><p className="text-sm font-extrabold">Želim ponovo</p><p className="mt-1 text-xs text-slate-500">Dodaj radnika u Moje ljude</p></div><Switch checked={wantAgain} onCheckedChange={setWantAgain} aria-label="Dodaj u Moje ljude" /></div><Button disabled={!assignmentId} onClick={() => { onRate(assignmentId, rating, wantAgain); onOpenChange(false); }} className="h-11 rounded-xl bg-[#ff5b35] font-bold hover:bg-[#e94b27]">Sačuvaj ocjenu</Button></DialogContent></Dialog>;
}

function HeroMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/[.06] p-3"><span className="text-[#ff9b83] [&_svg]:size-4">{icon}</span><div><p className="text-sm font-extrabold">{value}</p><p className="text-[10px] text-white/40">{label}</p></div></div>;
}

function FlowStep({ number, title, copy, active }: { number: string; title: string; copy: string; active?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${active ? 'border-[#d6d7ff] bg-[#f7f6ff]' : 'border-slate-100 bg-slate-50'}`}><span className={`font-display text-xs font-black ${active ? 'text-[#6e59db]' : 'text-slate-300'}`}>{number}</span><p className="mt-3 text-sm font-extrabold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div>;
}

function NoActiveShift({ onPost }: { onPost: () => void }) {
  return <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-500" /><h2 className="font-display mt-4 text-2xl font-black">Nema aktivnih smjena</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Objavi stvarnu potrebu i prati popunjavanje u realnom vremenu.</p><div className="mt-5 flex justify-center"><Button onClick={onPost} className="rounded-xl bg-[#ff5b35] hover:bg-[#e94b27]"><Plus /> Nova smjena</Button></div></div>;
}

function metricPercent(value: number | null) {
  return value === null ? '—' : `${value}%`;
}
