'use client';

import { useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CircleUserRound,
  Clock3,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toast';
import { EmployerDashboard } from '@/components/smjena/employer-dashboard';
import { Brand } from '@/components/smjena/shared';
import { WorkerDashboard } from '@/components/smjena/worker-dashboard';
import { useSmjenaDemo } from '@/hooks/use-smjena-demo';

type RoleView = 'worker' | 'employer';

export function SmjenaApp() {
  const demo = useSmjenaDemo();
  const [role, setRole] = useState<RoleView>('worker');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const activeShift = demo.state.shifts.find((shift) => shift.id === demo.state.activeShiftId);
  const openEmployerShift = demo.state.shifts.find((shift) => shift.employer === demo.state.employer.name && shift.status === 'open');

  return (
    <Toaster>
      <main className="min-h-screen bg-[#f6f7f9] text-[#101827]">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f7f9]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Brand />
            <div className="hidden items-center gap-5 md:flex">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="size-3.5" /> Budva · 20 km</span>
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-emerald-700"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /> Demo mreža aktivna</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={demo.resetDemo} variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" aria-label="Resetuj demo"><RotateCcw /></Button>
              <Button onClick={() => setNotificationsOpen(true)} variant="ghost" size="icon" className="relative rounded-full" aria-label="Obavijesti"><Bell /><span className="absolute right-2 top-1.5 size-2 rounded-full border-2 border-[#f6f7f9] bg-[#ff5b35]" /></Button>
              <span className="grid size-9 place-items-center rounded-full bg-[#101d34] text-xs font-extrabold text-white">{role === 'worker' ? demo.state.worker.initials : 'PB'}</span>
            </div>
          </div>
        </header>

        <Tabs value={role} onValueChange={(value) => value && setRole(value as RoleView)} className="mx-auto max-w-[1240px] gap-0 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-5">
            <TabsList className="h-10 rounded-full bg-slate-200/70 p-1">
              <TabsTrigger value="worker" className="h-8 min-w-32 rounded-full px-5 font-bold data-active:shadow-sm"><CircleUserRound /> Radnik</TabsTrigger>
              <TabsTrigger value="employer" className="h-8 min-w-32 rounded-full px-5 font-bold data-active:shadow-sm"><BriefcaseBusiness /> Poslodavac</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="worker">
            <WorkerDashboard
              state={demo.state}
              onClaim={demo.claimShift}
              onCheckIn={demo.checkIn}
              onCheckOut={demo.checkOut}
              onAvailability={demo.setAvailable}
              onNotifications={demo.setNotificationsEnabled}
              onDismissReward={demo.dismissReward}
              onReset={demo.resetDemo}
            />
          </TabsContent>
          <TabsContent value="employer">
            <EmployerDashboard
              state={demo.state}
              onPost={demo.postShift}
              onRaisePay={demo.raisePay}
              onBroadcast={demo.broadcastShift}
              onReplacement={demo.activateReplacement}
              onReset={demo.resetDemo}
            />
          </TabsContent>
        </Tabs>

        <footer className="border-t border-slate-200 bg-white/70 px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-[1176px] flex-wrap items-center justify-between gap-4">
            <div><Brand /><p className="mt-2 text-xs text-slate-500">Trebaš radnika? Nađi ga danas. Trebaš novac? Radi danas.</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="h-7 rounded-full"><ShieldCheck /> Interaktivni MVP</Badge><span className="text-[11px] text-slate-400">Podaci se čuvaju samo na ovom uređaju.</span></div>
          </div>
        </footer>

        <nav className="mobile-nav" aria-label="Glavna navigacija">
          <button onClick={() => { setRole('worker'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={role === 'worker' ? '!text-[#ff5b35]' : ''}><Zap /><span>Smjene</span></button>
          <button onClick={() => { setRole('employer'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={role === 'employer' ? '!text-[#ff5b35]' : ''}><BriefcaseBusiness /><span>Objavi</span></button>
          <button onClick={() => { setRole('worker'); document.querySelector('aside')?.scrollIntoView({ behavior: 'smooth' }); }}><WalletCards /><span>Zarada</span></button>
          <button onClick={() => setNotificationsOpen(true)}><Bell /><span>Obavijesti</span></button>
        </nav>

        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DialogContent className="rounded-[24px] sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display text-2xl font-black">Obavijesti</DialogTitle><DialogDescription>Svaka dobra obavijest ima stvarnu ekonomsku vrijednost.</DialogDescription></DialogHeader>
            <div className="space-y-2">
              <NotificationItem icon={<Zap />} color="bg-[#fff0eb] text-[#ff5b35]" title={activeShift ? 'Smjena je tvoja' : 'SOS smjena blizu tebe'} copy={activeShift ? `${activeShift.role} · počinje za ${activeShift.startsIn}` : 'Konobar · 900 m · €84 · počinje za 3h'} time="sada" />
              <NotificationItem icon={<Users />} color="bg-[#f1f0ff] text-[#6e59db]" title={openEmployerShift ? `${openEmployerShift.claimedWorkers.length}/${openEmployerShift.workersNeeded} mjesta popunjeno` : 'Moji ljudi su spremni'} copy="23 provjerena radnika dobijaju prvi pristup." time="prije 4 min" />
              <NotificationItem icon={<Clock3 />} color="bg-emerald-50 text-emerald-700" title="Sedmični pregled" copy={`Luka je ove sedmice zaradio €${demo.state.worker.earningsWeek}.`} time="ponedjeljak" />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </Toaster>
  );
}

function NotificationItem({ icon, color, title, copy, time }: { icon: React.ReactNode; color: string; title: string; copy: string; time: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${color}`}>{icon}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-extrabold">{title}</p><span className="shrink-0 text-[10px] text-slate-400">{time}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div></div>;
}
