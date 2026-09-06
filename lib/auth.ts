import { z } from 'zod';
import { montenegroCities } from './montenegro.ts';

const LoginSchema = z.object({
  intent: z.literal('login'),
  email: z.email('Unesi ispravnu email adresu.'),
});

const RegistrationSchema = z
  .object({
    intent: z.literal('register'),
    email: z.email('Unesi ispravnu email adresu.'),
    fullName: z.string().trim().min(2, 'Unesi ime i prezime.').max(80),
    role: z.enum(['worker', 'employer']),
    companyName: z.string().trim().max(120).optional(),
    city: z.enum(montenegroCities),
  })
  .refine((value) => value.role !== 'employer' || Boolean(value.companyName), {
    message: 'Unesi naziv firme ili lokala.',
    path: ['companyName'],
  });

export function parseAuthSubmission(input: {
  intent: unknown;
  email: unknown;
  fullName?: unknown;
  role?: unknown;
  companyName?: unknown;
  city?: unknown;
}) {
  return input.intent === 'register'
    ? RegistrationSchema.safeParse(input)
    : LoginSchema.safeParse({ intent: 'login', email: input.email });
}
