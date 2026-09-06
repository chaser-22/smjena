'use server';

import { headers } from 'next/headers';
import { parseAuthSubmission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  email?: string;
  errors?: Record<string, string[]>;
};

export async function requestMagicLink(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = formData.get('intent') === 'register' ? 'register' : 'login';
  const submitted = {
    intent,
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
    companyName: formData.get('companyName') || undefined,
    city: formData.get('city'),
  };
  const parsed = parseAuthSubmission(submitted);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Provjeri podatke i pokušaj ponovo.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const headerStore = await headers();
  const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? headerStore.get('origin');
  let origin: string;
  try {
    const parsedOrigin = new URL(rawOrigin ?? '');
    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('Invalid protocol');
    origin = parsedOrigin.origin;
  } catch {
    return { status: 'error', message: 'Nije moguće odrediti adresu aplikacije.' };
  }

  const supabase = await createClient();
  const registration = parsed.data.intent === 'register' ? parsed.data : null;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: Boolean(registration),
      ...(registration ? {
        data: {
          full_name: registration.fullName,
          role: registration.role,
          company_name: registration.companyName,
          city: registration.city,
        },
      } : {}),
    },
  });

  if (error) {
    return {
      status: 'error',
      message: intent === 'login'
        ? 'Nijesmo poslali link. Provjeri email ili izaberi „Napravi nalog“ ako si ovdje prvi put.'
        : 'Registracija trenutno nije dostupna. Sačekaj minut i pokušaj ponovo.',
    };
  }

  return {
    status: 'success',
    email: parsed.data.email,
    message: `Siguran link je poslat na ${parsed.data.email}.`,
  };
}
