'use client';

import { useActionState, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Mail,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { requestMagicLink, type LoginState } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { montenegroCities } from '@/lib/montenegro';
import styles from '@/components/marketing/public.module.css';

const initialState: LoginState = { status: 'idle' };

export function LoginForm({
  initialIntent = 'login',
  initialRole = 'worker',
}: {
  initialIntent?: 'login' | 'register';
  initialRole?: 'worker' | 'employer';
}) {
  const [intent, setIntent] = useState<'login' | 'register'>(initialIntent);
  const [version, setVersion] = useState(0);
  const selectIntent = (next: 'login' | 'register') => {
    setIntent(next);
    document.getElementById(`${next}-auth-tab`)?.focus();
  };

  return (
    <div>
      <p className={styles.kicker}>
        {intent === 'login'
          ? 'LIJEPO TE JE VIDJETI PONOVO.'
          : 'TVOJA SLJEDEĆA SMJENA POČINJE OVDJE.'}
      </p>
      <h1>
        {intent === 'login' ? 'Dobro došao nazad.' : 'Hajde da se upoznamo.'}
      </h1>
      <p className={styles.authIntro}>
        {intent === 'login'
          ? 'Tvoj nalog je tu. Unesi email i poslaćemo ti link za prijavu.'
          : 'Izaberi svoju ulogu. Dodaj osnovne podatke i potvrdi email da otvoriš nalog.'}
      </p>
      <div
        role="tablist"
        aria-label="Prijava ili novi nalog"
        className="mb-6 grid min-w-0 grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5"
      >
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
      <div
        id="auth-form-panel"
        role="tabpanel"
        aria-labelledby={`${intent}-auth-tab`}
      >
        <AuthForm
          key={`${intent}-${version}`}
          intent={intent}
          initialRole={initialRole}
          onReset={() => setVersion((value) => value + 1)}
        />
      </div>
    </div>
  );
}

function AuthForm({
  intent,
  initialRole,
  onReset,
}: {
  intent: 'login' | 'register';
  initialRole: 'worker' | 'employer';
  onReset: () => void;
}) {
  const [role, setRole] = useState<'worker' | 'employer'>(initialRole);
  const [values, setValues] = useState({
    fullName: '',
    companyName: '',
    city: 'Budva',
    email: '',
  });
  const [state, action, pending] = useActionState(
    async (previous: LoginState, data: FormData): Promise<LoginState> => {
      try {
        return await requestMagicLink(previous, data);
      } catch {
        return {
          status: 'error',
          message:
            'Veza je prekinuta. Nijesmo potvrdili slanje linka. Provjeri internet i pokušaj ponovo.',
        };
      }
    },
    initialState,
  );

  if (state.status === 'success') {
    return (
      <div
        aria-live="polite"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-7 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h3 className="mt-4 text-xl font-black">Provjeri email</h3>
        <p className="mt-2 break-words text-sm leading-6 text-emerald-950">
          {state.message}
        </p>
        <p className="mt-3 text-xs leading-5 text-emerald-900">
          Link važi jednom. Otvori ga u ovom pregledniku. Ako ga ne vidiš,
          provjeri Spam ili Neželjenu poštu.
        </p>
        <Button
          type="button"
          onClick={onReset}
          variant="outline"
          className="mt-5 min-h-11 rounded-xl border-emerald-300 bg-white font-bold text-emerald-900 hover:bg-emerald-100"
        >
          <RotateCcw /> Unesi drugi email
        </Button>
      </div>
    );
  }

  return (
    <form action={action} aria-busy={pending} className="space-y-5">
      <input type="hidden" name="intent" value={intent} />
      {intent === 'register' && (
        <>
          <fieldset>
            <legend className="mb-2 text-xs font-extrabold text-slate-700">
              Otvaram nalog kao
            </legend>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
              {(['worker', 'employer'] as const).map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={role === option}
                    onChange={() => setRole(option)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition peer-focus-visible:ring-3 peer-focus-visible:ring-[#ff5b35]/40 ${role === option ? 'bg-white text-[#101d34] shadow-sm' : 'text-slate-500'}`}
                  >
                    {option === 'worker' ? (
                      <>
                        <UserRound className="size-4" /> Radnik
                      </>
                    ) : (
                      <>
                        <Building2 className="size-4" /> Poslodavac
                      </>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Uloga se trajno veže za ovaj email. Za drugu ulogu koristi drugi
              email.
            </p>
          </fieldset>

          <Field
            id="fullName"
            label={role === 'worker' ? 'Ime i prezime' : 'Ime odgovorne osobe'}
            error={state.errors?.fullName?.[0]}
          >
            <Input
              id="fullName"
              name="fullName"
              value={values.fullName}
              onChange={(event) =>
                setValues({ ...values, fullName: event.target.value })
              }
              autoComplete="name"
              required
              aria-invalid={Boolean(state.errors?.fullName)}
              aria-describedby={
                state.errors?.fullName ? 'fullName-error' : undefined
              }
              placeholder="Marko Marković"
              className="h-12 rounded-xl"
            />
          </Field>

          {role === 'employer' && (
            <Field
              id="companyName"
              label="Naziv firme ili lokala"
              error={state.errors?.companyName?.[0]}
            >
              <Input
                id="companyName"
                name="companyName"
                value={values.companyName}
                onChange={(event) =>
                  setValues({ ...values, companyName: event.target.value })
                }
                autoComplete="organization"
                required
                aria-invalid={Boolean(state.errors?.companyName)}
                aria-describedby={
                  state.errors?.companyName ? 'companyName-error' : undefined
                }
                placeholder="Hotel Adriatic"
                className="h-12 rounded-xl"
              />
            </Field>
          )}

          <Field id="city" label="Grad" error={state.errors?.city?.[0]}>
            <select
              id="city"
              name="city"
              required
              value={values.city}
              onChange={(event) =>
                setValues({ ...values, city: event.target.value })
              }
              aria-invalid={Boolean(state.errors?.city)}
              aria-describedby={state.errors?.city ? 'city-error' : undefined}
              className="h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {montenegroCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field id="email" label="Email" error={state.errors?.email?.[0]}>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="email"
            name="email"
            value={values.email}
            onChange={(event) =>
              setValues({ ...values, email: event.target.value })
            }
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
            placeholder="ime@email.com"
            className="h-12 rounded-xl pl-10"
          />
        </div>
      </Field>

      {state.message && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {state.message}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-[#ff5b35] text-sm font-extrabold hover:bg-[#e94b27]"
      >
        {pending
          ? 'Šaljemo siguran link…'
          : intent === 'login'
            ? 'Pošalji link za prijavu'
            : 'Napravi nalog'}{' '}
        {!pending && <ArrowRight />}
      </Button>
      <p className="text-center text-[11px] leading-5 text-slate-400">
        Bez lozinke. Link vrijedi samo jednom i otvara tvoj nalog.
      </p>
      <output className="sr-only" aria-live="polite">
        {pending ? 'Šaljemo link na email' : ''}
      </output>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-extrabold text-slate-700"
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-xs font-semibold text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
