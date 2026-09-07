'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, BriefcaseBusiness, Clock3, LogOut, MapPin, PhoneCall, ShieldCheck, Users, WalletCards, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Toaster, toast } from '@/components/ui/toast';
import { EmployerDashboard } from '@/components/smjena/employer-dashboard';
import { Brand } from '@/components/smjena/shared';
import { WorkerDashboard } from '@/components/smjena/worker-dashboard';
import { createClient } from '@/lib/supabase/client';
import type { DashboardData } from '@/lib/smjena-data';
import type { ActionResult } from '@/app/dashboard/actions';
import {
  broadcastShiftAction,
  cancelAssignmentAction,
  cancelShiftAction,
  checkInAction,
  checkOutAction,
  claimShiftAction,
  authorizePaymentAction,
  logoutAction,
  markNoShowAction,
  postShiftAction,
  raiseShiftPayAction,
  rateAssignmentAction,
  setAvailabilityAction,
  setNotificationsAction,
  updateContactAction,
} from '@/app/dashboard/actions';
import { formatMontenegroPhone, type NewShiftInput } from '@/lib/smjena';

export function SmjenaApp({ data }: { data: DashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { state, role } = data;
  const activeShift = state.shifts.find((shift) => shift.id === state.activeShiftId);
  const openEmployerShift = state.shifts.find((shift) => shift.status === 'open');

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard:${data.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.userId, router]);

  const run = (operation: () => Promise<ActionResult>, success: string | ((result: Extract<ActionResult, { ok: true }>) => string)): Promise<boolean> => {
    return new Promise((resolve) => startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) {
          toast.add({ title: 'Akcija nije završena', description: result.error, type: 'warning' });
          resolve(false);
          return;
        }
        toast.add({ title: typeof success === 'function' ? success(result) : success, type: 'success' });
        router.refresh();
        resolve(true);
      } catch {
        toast.add({ title: 'Veza je prekinuta', description: 'Provjeri internet i pokušaj ponovo. Nijesmo potvrdili ovu akciju.', type: 'warning' });
        resolve(false);
      }
    }));
  };

  const postShift = (input: NewShiftInput) => run(() => postShiftAction(input), 'Smjena je objavljena');

  return (
    <Toaster>
      <main id="main-content" className="min-h-screen bg-[#f6f7f9] text-[#101827]">
        {pending && <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-[#ffddd4]"><div className="h-full w-1/2 animate-pulse bg-[#ff5b35]" /></div>}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f7f9]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Brand />
            <div className="hidden items-center gap-5 md:flex">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="size-3.5" /> {role === 'employer' ? state.employer.city : state.worker.city}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-emerald-700"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /> Produkcijska mreža</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setNotificationsOpen(true)} variant="ghost" size="icon" className="relative size-11 rounded-full" aria-label="Aktivnost naloga"><Bell /></Button>
              <form action={logoutAction}><Button type="submit" variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Odjavi se"><LogOut /></Button></form>
              <button type="button" onClick={() => setContactOpen(true)} className="grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b35]" aria-label="Otvori kontakt podatke"><span className="grid size-9 place-items-center rounded-full bg-[#101d34] text-xs font-extrabold text-white">{role === 'worker' ? state.worker.initials : data.profileName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span></button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-5">
            <Badge className="h-9 rounded-full bg-[#101d34] px-4 text-xs font-bold text-white">
              {role === 'worker' ? <><Users /> Radnički nalog</> : <><BriefcaseBusiness /> Poslodavac</>}
            </Badge>
          </div>
          {!data.contactPhone && (
            <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4" aria-labelledby="contact-required-heading">
              <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><PhoneCall className="size-5" /></span><div><h2 id="contact-required-heading" className="text-sm font-extrabold text-amber-950">Dodaj kontakt telefon</h2><p className="mt-1 text-xs leading-5 text-amber-900/75">Potreban je prije {role === 'worker' ? 'potvrde smjene' : 'objave smjene'}. Vidi ga samo druga strana nakon potvrđenog angažmana.</p></div></div>
              <Button onClick={() => setContactOpen(true)} className="h-11 rounded-xl bg-[#101d34] font-bold hover:bg-[#1c2d49]"><PhoneCall /> Dodaj broj</Button>
            </section>
          )}
          {role === 'worker' ? (
            <WorkerDashboard
              state={state}
              busy={pending}
              contactReady={Boolean(data.contactPhone)}
              onContactRequired={() => setContactOpen(true)}
              highlightShiftId={searchParams.get('shift') ?? undefined}
              onClaim={(id) => run(() => claimShiftAction(id, searchParams.get('source') === 'push' ? 'push' : 'dashboard'), 'Smjena je tvoja')}
              onCheckIn={(id) => run(() => checkInAction(id), 'Dolazak je potvrđen')}
              onCheckOut={(id) => run(() => checkOutAction(id), (result) => `Smjena završena · €${result.amount ?? 0} evidentirano za obračun`)}
              onCancel={(id) => run(() => cancelAssignmentAction(id), 'Smjena je otkazana i mjesto je ponovo otvoreno')}
              onAvailability={(available) => run(() => setAvailabilityAction(available), available ? 'Sada si dostupan' : 'Dostupnost je isključena')}
              onNotifications={(enabled, subscription) => run(() => setNotificationsAction(enabled, subscription), enabled ? 'Obavijesti su uključene' : 'Obavijesti su isključene')}
              onReset={() => router.refresh()}
            />
          ) : (
            <EmployerDashboard
              state={state}
              busy={pending}
              contactReady={Boolean(data.contactPhone)}
              onContactRequired={() => setContactOpen(true)}
              onPost={postShift}
              onRaisePay={(id) => run(() => raiseShiftPayAction(id), 'Ponuda je povećana za €10')}
              onBroadcast={(id) => run(() => broadcastShiftAction(id), 'Smjena je poslata javnoj mreži')}
              onRate={(assignmentId, score, wantAgain) => run(() => rateAssignmentAction(assignmentId, score, wantAgain), 'Ocjena je sačuvana')}
              onCancelShift={(id) => run(() => cancelShiftAction(id), (result) => result.count ? `Smjena je otkazana · ${result.count} ${result.count === 1 ? 'potvrđeno mjesto je oslobođeno' : 'potvrđena mjesta su oslobođena'}` : 'Smjena je otkazana')}
              onAuthorizePayment={(assignmentId) => run(() => authorizePaymentAction(assignmentId), (result) => `Obaveza od €${result.amount ?? 0} je potvrđena · uplata nije izvršena`)}
              onMarkNoShow={(assignmentId) => run(() => markNoShowAction(assignmentId), 'Nedolazak je evidentiran · pokrenuta je potraga za zamjenom ako smjena još traje')}
            />
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white/70 px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-[1176px] flex-wrap items-center justify-between gap-4">
            <div><Brand /><p className="mt-2 text-xs text-slate-500">Trebaš radnika? Nađi ga danas. Trebaš novac? Radi danas.</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="h-7 rounded-full"><ShieldCheck /> Zaštićen nalog</Badge><span className="text-[11px] text-slate-400">Podaci se čuvaju u produkcijskoj bazi.</span></div>
          </div>
        </footer>

        <nav className="mobile-nav" aria-label="Glavna navigacija">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="!text-[#ff5b35]">{role === 'worker' ? <Zap /> : <BriefcaseBusiness />}<span>{role === 'worker' ? 'Smjene' : 'Početak'}</span></button>
          <button onClick={() => document.querySelector('aside')?.scrollIntoView({ behavior: 'smooth' })}><WalletCards /><span>{role === 'worker' ? 'Zarada' : 'Rezultati'}</span></button>
          <button onClick={() => setNotificationsOpen(true)}><Bell /><span>Aktivnost</span></button>
          <form action={logoutAction}><button type="submit"><LogOut /><span>Odjava</span></button></form>
        </nav>

        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DialogContent className="rounded-[24px] sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display text-2xl font-black">Aktivnost</DialogTitle><DialogDescription>Promjene sačuvane na tvom nalogu.</DialogDescription></DialogHeader>
            <div className="space-y-2">
              {activeShift && <NotificationItem icon={<Zap />} color="bg-[#fff0eb] text-[#ff5b35]" title="Aktivna smjena" copy={`${activeShift.role} · ${activeShift.dayLabel} u ${activeShift.start}`} />}
              {role === 'employer' && openEmployerShift && <NotificationItem icon={<Users />} color="bg-[#f1f0ff] text-[#6e59db]" title={`${openEmployerShift.claimedCount}/${openEmployerShift.workersNeeded} mjesta popunjeno`} copy={`${openEmployerShift.role} · ${openEmployerShift.area}`} />}
              {!activeShift && !(role === 'employer' && openEmployerShift) && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><Clock3 className="mx-auto size-5 text-slate-300" /><p className="mt-2 text-sm font-bold">Nema novih aktivnosti</p></div>}
            </div>
          </DialogContent>
        </Dialog>
        <ContactDialog
          open={contactOpen}
          onOpenChange={setContactOpen}
          phone={data.contactPhone}
          busy={pending}
          onSave={async (phone) => {
            const saved = await run(() => updateContactAction(phone), data.contactPhone ? 'Kontakt telefon je ažuriran' : 'Kontakt telefon je dodat');
            if (saved) setContactOpen(false);
          }}
        />
        <output className="sr-only" aria-live="polite">{pending ? 'Obrada u toku' : 'Spremno'}</output>
      </main>
    </Toaster>
  );
}

function ContactDialog({ open, onOpenChange, phone, busy, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; phone: string | null; busy: boolean; onSave: (phone: string) => Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }}>
      <DialogContent className="rounded-[24px] sm:max-w-sm">
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave(String(data.get('phone') ?? '')); }}>
          <DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#ff5b35]"><PhoneCall className="size-5" /></div><DialogTitle className="font-display text-2xl font-black">Kontakt telefon</DialogTitle><DialogDescription>Koristi se samo za dogovor oko potvrđene smjene. Ne prikazuje se u javnoj ponudi.</DialogDescription></DialogHeader>
          <Field className="mt-5"><FieldLabel htmlFor="contact-phone">Broj iz Crne Gore</FieldLabel><Input id="contact-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone ? formatMontenegroPhone(phone) : ''} placeholder="067 123 456" required className="h-11 rounded-xl" /><p className="mt-1 text-[11px] leading-5 text-slate-500">Prihvatamo 067 123 456 ili +382 67 123 456.</p></Field>
          <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-xl bg-[#ff5b35] font-extrabold hover:bg-[#e94b27]">{busy ? 'Čuvam…' : 'Sačuvaj broj'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotificationItem({ icon, color, title, copy }: { icon: React.ReactNode; color: string; title: string; copy: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${color}`}>{icon}</span><div><p className="text-sm font-extrabold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div></div>;
}
