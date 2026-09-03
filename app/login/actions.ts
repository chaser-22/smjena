'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const LoginSchema = z
  .object({
    email: z.email('Unesi ispravnu email adresu.'),
    fullName: z.string().trim().min(2, 'Unesi ime i prezime.').max(80),
    role: z.enum(['worker', 'employer']),
    companyName: z.string().trim().max(120).optional(),
    city: z.enum(['Budva', 'Podgorica', 'Tivat', 'Kotor', 'Herceg Novi', 'Bar', 'Nikšić']),
  })
  .refine((value) => value.role !== 'employer' || Boolean(value.companyName), {
    message: 'Unesi naziv firme ili lokala.',
    path: ['companyName'],
  });

export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string[]>;
};

export async function requestMagicLink(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
    companyName: formData.get('companyName') || undefined,
    city: formData.get('city'),
  });

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
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        company_name: parsed.data.companyName,
        city: parsed.data.city,
      },
    },
  });

  if (error) return { status: 'error', message: 'Prijava trenutno nije dostupna. Pokušaj ponovo.' };

  return {
    status: 'success',
    message: `Siguran link za prijavu je poslat na ${parsed.data.email}.`,
  };
}
