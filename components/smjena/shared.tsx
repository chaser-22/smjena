'use client';

import {
  BriefcaseBusiness,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  completionPercent,
  remainingSpots,
  type Shift,
} from '@/lib/smjena';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="SMJENA">
      <span className="brand-mark grid size-9 place-items-center rounded-[12px] bg-[#ff5b35] text-white shadow-[0_8px_24px_rgba(255,91,53,.28)]">
        <Zap className="size-[18px] fill-current" />
      </span>
      {!compact && (
        <span className="font-display text-[19px] font-black tracking-[-0.04em]">
          SMJENA
        </span>
      )}
    </div>
  );
}

export function Avatar({ initials, color = 'bg-[#101d34]', size = 'md' }: { initials: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'size-8 text-[9px]' : size === 'lg' ? 'size-12 text-xs' : 'size-9 text-[10px]';
  return (
    <span className={`grid ${sizeClass} shrink-0 place-items-center rounded-full border-2 border-white font-extrabold text-white ${color}`}>
      {initials}
    </span>
  );
}

export function Metric({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <p className={`font-display text-lg font-black tracking-[-.03em] ${accent ?? ''}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-slate-400">{label}</p>
    </div>
  );
}

export function ShiftCard({ shift, onClaim, featured = false, disabled = false, disabledLabel }: { shift: Shift; onClaim: () => void; featured?: boolean; disabled?: boolean; disabledLabel?: string }) {
  if (featured) {
    return (
      <article className="featured-shift relative overflow-hidden rounded-[30px] bg-[#101d34] p-5 text-white shadow-[0_28px_70px_rgba(16,29,52,.2)] sm:p-7">
        <div className="absolute -right-20 -top-24 size-72 rounded-full border-[48px] border-white/[.035]" />
        <div className="relative">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {shift.urgent && (
                <Badge className="h-7 gap-1.5 rounded-full bg-[#ff5b35] px-3 text-[11px] font-extrabold uppercase tracking-[.08em]">
                  <Zap className="fill-current" /> SOS smjena
                </Badge>
              )}
              {shift.audience === 'crew' && (
                <Badge className="h-7 rounded-full border border-[#77f0bd]/30 bg-[#77f0bd]/10 px-3 text-[11px] font-bold text-[#77f0bd]">
                  Moji ljudi
                </Badge>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
              <MapPin className="size-3.5" /> {shift.distance}
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#ff9b83]">Počinje za {shift.startsIn}</p>
              <h2 className="font-display mt-2 text-[clamp(2rem,5vw,3.4rem)] font-black leading-none tracking-[-.055em]">{shift.role}</h2>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
                <span className="flex items-center gap-1.5">
                  {shift.employer}
                  {shift.employerVerified && <ShieldCheck className="size-3.5 text-[#77f0bd]" aria-label="Verifikovan poslodavac" />}
                  <span aria-label={shift.employerRating === null ? 'Poslodavac još nema ocjene' : `Ocjena poslodavca ${shift.employerRating.toFixed(1)}`}>
                    {shift.employerRating === null ? '· Nova firma' : <>· <Star className="mb-0.5 inline size-3.5 fill-[#ffcc73] text-[#ffcc73]" /> {shift.employerRating.toFixed(1)}</>}
                  </span>
                </span>
                <span>{shift.dayLabel} · {shift.start}–{shift.end}</span>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="font-display text-4xl font-black tracking-[-.05em]">€{shift.pay}</p>
              <p className="mt-1 text-xs font-bold text-[#77f0bd]">ukupna naknada{shift.tips ? ' · moguće napojnice' : ''}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {shift.requirements.map((requirement) => (
              <span key={requirement} className="rounded-full bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold text-white/60">{requirement}</span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <Button onClick={onClaim} disabled={disabled} className="claim-button h-12 min-w-52 rounded-xl bg-[#ff5b35] px-6 text-[15px] font-extrabold hover:bg-[#e94b27]">
              <Zap className="fill-current" /> {disabled ? (disabledLabel ?? 'NIJE DOSTUPNO') : 'UZMI SMJENU'}
            </Button>
            <span className="text-xs font-semibold text-white/50">
              {remainingSpots(shift)} od {shift.workersNeeded} mjesta slobodno
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group grid gap-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className={`hidden size-12 place-items-center rounded-2xl text-white sm:grid ${shift.urgent ? 'bg-[#ff5b35]' : shift.audience === 'crew' ? 'bg-[#6e59db]' : 'bg-[#16896c]'}`}>
        {shift.urgent ? <Zap className="size-5 fill-current" /> : <BriefcaseBusiness className="size-5" />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display truncate text-lg font-black tracking-[-.025em]">{shift.role}</h3>
          {shift.audience === 'crew' && <Badge className="bg-[#f1f0ff] text-[#5c4ec9]">Prvo za ekipu</Badge>}
          {shift.replacementActive && <Badge className="bg-[#fff0eb] text-[#e94b27]">Traži zamjenu</Badge>}
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{shift.employer} · {shift.area}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-slate-400" /> {shift.dayLabel} · {shift.start}–{shift.end}</span>
          <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-slate-400" /> {shift.distance}</span>
          <span className="flex items-center gap-1.5"><Users className="size-3.5 text-slate-400" /> {remainingSpots(shift)} mjesta</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
        <div>
          <p className="font-display text-2xl font-black tracking-[-.04em]">€{shift.pay}</p>
          <p className="text-[11px] font-semibold text-slate-400">{shift.tips ? '+ napojnice' : 'ukupno'}</p>
        </div>
        <Button onClick={onClaim} disabled={disabled} variant="outline" className="mt-2 h-11 rounded-xl px-4 font-bold group-hover:border-[#ffb6a4] group-hover:text-[#e94b27]">
          {disabled ? (disabledLabel ?? 'Nije dostupno') : 'Uzmi'}
        </Button>
      </div>
    </article>
  );
}

export function FillProgress({ shift }: { shift: Shift }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold">
        <span>{shift.claimedCount} / {shift.workersNeeded} popunjeno</span>
        <span className={remainingSpots(shift) === 0 ? 'text-[#77f0bd]' : 'text-white/50'}>
          {remainingSpots(shift) === 0 ? 'Smjena popunjena' : `Još ${remainingSpots(shift)}`}
        </span>
      </div>
      <Progress value={completionPercent(shift)} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#77f0bd]" />
    </div>
  );
}
