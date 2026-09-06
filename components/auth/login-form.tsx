'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Mail, RotateCcw, UserRound } from 'lucide-react';
import { requestMagicLink, type LoginState } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { montenegroCities } from '@/lib/montenegro';

const initialState: LoginState = { status: 'idle' };

export function LoginForm() {
  const [intent, setIntent] = useState<'login' | 'register'>('login');
  const [version, setVersion] = useState(0);
  const selectIntent = (next: 'login' | 'register') => {
    setIntent(next);
    document.getElementById(`${next}-auth-tab`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Prijava ili novi nalog" className="mb-6 grid min-w-0 grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        {(['login', 'register'] as const).map((option) => (
          <button
            key={option}
            id={`${option}-auth-tab`}
            type="button"
            role="tab"
            aria-selected={intent === option}
            aria-controls="auth-form-panel"
            tabIndex={intent === option ? 0 : -1}
            onClick={() => setIntent(option)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                selectIntent(option === 'login' ? 'register' : 'login');
              }
              if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                selectIntent(event.key === 'Home' ? 'login' : 'register');
              }
            }}
            className={`min-h-11 min-w-0 rounded-xl px-2 text-xs font-extrabold transition sm:px-3 sm:text-sm ${intent === option ? 'bg-white text-[#101d34] shadow-sm' : 'text-slate-500'}`}
          >
            {option === 'login' ? 'Imam nalog' : 'Napravi nalog'}
          </button>
        ))}
      </div>
      <div id="auth-form-panel" role="tabpanel" aria-labelledby={`${intent}-auth-tab`}>
        <AuthForm key={`${intent}-${version}`} intent={intent} onReset={() => setVersion((value) => value + 1)} />
      </div>
    </div>
  );
}

function AuthForm({ intent, onReset }: { intent: 'login' | 'register'; onReset: () => void }) {
  const [role, setRole] = useState<'worker' | 'employer'>('worker');
  const [state, action, pending] = useActionState(requestMagicLink, initialState);

  if (state.status === 'success') {
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-7 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h3 className="mt-4 text-xl font-black">Provjeri email</h3>
        <p className="mt-2 text-sm leading-6 text-emerald-900/70">{state.message}</p>
        <p className="mt-3 text-xs leading-5 text-emerald-900/60">Link važi jednom. Ako ga ne vidiš, provjeri Spam ili Neželjenu poštu.</p>
        <Button type="button" onClick={onReset} variant="outline" className="mt-5 min-h-11 rounded-xl border-emerald-300 bg-white font-bold text-emerald-900 hover:bg-emerald-100">
          <RotateCcw /> Unesi drugi email
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value={intent} />
      {intent === 'register' && <input type="hidden" name="role" value={role} />}

      {intent === 'register' && (
        <>
          <div>
            <p className="mb-2 text-xs font-extrabold text-slate-700">Otvaram nalog kao</p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
              <button type="button" aria-pressed={role === 'worker'} onClick={() => setRole('worker')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${role === 'worker' ? 'bg-white text-[#101d34] shadow-sm' : 'text-slate-500'}`}><UserRound className="size-4" /> Radnik</button>
              <button type="button" aria-pressed={role === 'employer'} onClick={() => setRole('employer')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${role === 'employer' ? 'bg-white text-[#101d34] shadow-sm' : 'text-slate-500'}`}><Building2 className="size-4" /> Poslodavac</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Uloga se trajno veže za ovaj email. Za drugu ulogu koristi drugi email.</p>
          </div>

          <Field id="fullName" label={role === 'worker' ? 'Ime i prezime' : 'Ime odgovorne osobe'} error={state.errors?.fullName?.[0]}>
            <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={Boolean(state.errors?.fullName)} aria-describedby={state.errors?.fullName ? 'fullName-error' : undefined} placeholder="Marko Marković" className="h-12 rounded-xl" />
          </Field>

          {role === 'employer' && (
            <Field id="companyName" label="Naziv firme ili lokala" error={state.errors?.companyName?.[0]}>
              <Input id="companyName" name="companyName" autoComplete="organization" required aria-invalid={Boolean(state.errors?.companyName)} aria-describedby={state.errors?.companyName ? 'companyName-error' : undefined} placeholder="Hotel Adriatic" className="h-12 rounded-xl" />
            </Field>
          )}

          <Field id="city" label="Grad" error={state.errors?.city?.[0]}>
            <select id="city" name="city" required defaultValue="Budva" aria-invalid={Boolean(state.errors?.city)} aria-describedby={state.errors?.city ? 'city-error' : undefined} className="h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              {montenegroCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </Field>
        </>
      )}

      <Field id="email" label="Email" error={state.errors?.email?.[0]}>
        <div className="relative"><Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? 'email-error' : undefined} placeholder="ime@email.com" className="h-12 rounded-xl pl-10" /></div>
      </Field>

      {state.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{state.message}</p>}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-[#ff5b35] text-sm font-extrabold hover:bg-[#e94b27]">
        {pending ? 'Šaljemo siguran link…' : intent === 'login' ? 'Pošalji link za prijavu' : 'Napravi nalog'} {!pending && <ArrowRight />}
      </Button>
      <p className="text-center text-[11px] leading-5 text-slate-400">Bez lozinke. Link vrijedi samo jednom i otvara tvoj nalog.</p>
      <output className="sr-only" aria-live="polite">{pending ? 'Šaljemo link na email' : ''}</output>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-extrabold text-slate-700">{label}</label>{children}{error && <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}</div>;
}
