import { createServerClient } from '@supabase/ssr';
import type { Browser, BrowserContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createStagingAdmin,
  requireStagingTestConfig,
  type StagingTestConfig,
} from './staging-safety';

type FixtureIds = {
  employerId?: string;
  employerUserId?: string;
  shiftIds: string[];
  workerUserId?: string;
};

type BrowserCookie = Parameters<BrowserContext['addCookies']>[0][number];

test.describe('staging worker–employer acceptance journey', () => {
  test.describe.configure({ mode: 'serial' });

  test('publishes, claims, exposes reciprocal contacts, and safely cancels a shift', async ({
    browser,
  }) => {
    const config = requireStagingTestConfig();
    const admin = createStagingAdmin(config);
    const ids: FixtureIds = { shiftIds: [] };
    const suffix = `${Date.now()}-${process.pid}`;
    const password = `Smjena-E2E-${crypto.randomUUID()}!`;
    const workerEmail = `e2e-worker-${suffix}@smjena.test`;
    const employerEmail = `e2e-employer-${suffix}@smjena.test`;
    let workerContext: BrowserContext | undefined;
    let employerContext: BrowserContext | undefined;

    try {
      ids.workerUserId = await createFixtureUser(admin, {
        email: workerEmail,
        password,
        role: 'worker',
        fullName: `E2E Radnik ${suffix}`,
        city: 'Budva',
      });
      ids.employerUserId = await createFixtureUser(admin, {
        email: employerEmail,
        password,
        role: 'employer',
        fullName: `E2E Poslodavac ${suffix}`,
        companyName: `E2E Hotel ${suffix}`,
        city: 'Budva',
      });

      ids.employerId = await waitForEmployer(admin, ids.employerUserId);
      workerContext = await authenticatedContext(
        browser,
        config,
        workerEmail,
        password,
      );
      employerContext = await authenticatedContext(
        browser,
        config,
        employerEmail,
        password,
      );
      const workerPage = await workerContext.newPage();
      const employerPage = await employerContext.newPage();

      await employerPage.goto('/dashboard');
      await expect(
        employerPage.getByText('Poslodavac', { exact: true }),
      ).toBeVisible();
      await addContactPhone(employerPage, '067 911 001');

      await employerPage.getByRole('button', { name: 'NOVA SMJENA' }).click();
      const shiftDialog = employerPage.getByRole('dialog', {
        name: 'Nova smjena',
      });
      await expect(shiftDialog).toBeVisible();
      await shiftDialog.getByLabel('Broj ljudi').fill('1');
      await shiftDialog.getByLabel('Datum').fill(futureDate(7));
      await shiftDialog.getByLabel('Početak').fill('12:00');
      await shiftDialog.getByLabel('Završetak').fill('20:00');
      await shiftDialog.getByLabel('Ukupno po osobi (€)').fill('80');
      await shiftDialog
        .getByLabel('Tačna lokacija')
        .fill('E2E recepcija, Budva');
      await shiftDialog
        .getByLabel('Važni uslovi')
        .fill('crna košulja, iskustvo sa POS kasom');
      await shiftDialog.getByRole('button', { name: 'Objavi smjenu' }).click();
      await expect(
        employerPage.getByText('Smjena je objavljena'),
      ).toBeVisible();

      const shift = await waitForShift(admin, ids.employerId);
      ids.shiftIds.push(shift.id);

      await workerPage.goto('/dashboard');
      await expect(
        workerPage.getByText('Radnički nalog', { exact: true }),
      ).toBeVisible();
      await addContactPhone(workerPage, '067 911 002');
      const availability = workerPage.getByRole('switch', {
        name: 'Dostupan za smjene',
      });
      await availability.click();
      await expect(availability).toHaveAttribute('aria-checked', 'true');
      await expect(workerPage.getByText('Sada si dostupan')).toBeVisible();

      await workerPage.reload();
      await expect(workerPage.getByText('E2E recepcija, Budva')).toBeVisible();
      await workerPage
        .getByRole('button', { name: 'UZMI SMJENU' })
        .first()
        .click();
      await expect(
        workerPage.getByRole('dialog', { name: 'Uzimaš ovu smjenu?' }),
      ).toBeVisible();
      await workerPage.getByRole('button', { name: 'UZMI ODMAH' }).click();
      await expect(
        workerPage.getByText('Smjena je tvoja', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        workerPage.locator('a[href="tel:+38267911001"]'),
      ).toBeVisible();

      const assignment = await waitForAssignment(
        admin,
        shift.id,
        ids.workerUserId,
      );
      expect(assignment.status).toBe('claimed');
      const { count: ledgerCount, error: ledgerError } = await admin
        .from('payment_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id);
      assertNoError(ledgerError, 'read the payment ledger');
      expect(ledgerCount).toBe(0);

      await employerPage.reload();
      await expect(
        employerPage.getByText(`E2E Radnik ${suffix}`).first(),
      ).toBeVisible();
      await expect(
        employerPage.locator('a[href="tel:+38267911002"]').first(),
      ).toBeVisible();

      await workerPage
        .getByRole('button', { name: 'Otkaži', exact: true })
        .first()
        .click();
      await expect(
        workerPage.getByRole('dialog', { name: 'Otkazati smjenu?' }),
      ).toBeVisible();
      await workerPage
        .getByRole('button', { name: 'Potvrdi otkazivanje' })
        .click();
      await expect(
        workerPage.getByText('Smjena je otkazana i mjesto je ponovo otvoreno'),
      ).toBeVisible();

      const cancelled = await waitForAssignment(
        admin,
        shift.id,
        ids.workerUserId,
      );
      expect(cancelled.status).toBe('cancelled');
      const { data: reopened, error: reopenedError } = await admin
        .from('shifts')
        .select('status, claimed_count')
        .eq('id', shift.id)
        .single();
      assertNoError(reopenedError, 'read the reopened shift');
      expect(reopened).toMatchObject({ status: 'published', claimed_count: 0 });

      await employerPage.reload();
      await expect(
        employerPage.locator('a[href="tel:+38267911002"]'),
      ).toHaveCount(0);
    } finally {
      await workerContext?.close();
      await employerContext?.close();
      await cleanupFixtures(admin, ids);
    }
  });
});

async function createFixtureUser(
  admin: SupabaseClient,
  input: {
    email: string;
    password: string;
    role: 'worker' | 'employer';
    fullName: string;
    companyName?: string;
    city: string;
  },
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      full_name: input.fullName,
      company_name: input.companyName,
      city: input.city,
    },
  });
  assertNoError(error, `create ${input.role} fixture`);
  if (!data.user)
    throw new Error(`Supabase did not return the ${input.role} fixture user.`);
  return data.user.id;
}

async function authenticatedContext(
  browser: Browser,
  config: StagingTestConfig,
  email: string,
  password: string,
) {
  const cookieJar = new Map<string, BrowserCookie>();
  const client = createServerClient(config.supabaseURL, config.publishableKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) {
          cookieJar.set(cookie.name, {
            name: cookie.name,
            value: cookie.value,
            url: config.baseURL,
            httpOnly: Boolean(cookie.options.httpOnly),
            secure: Boolean(cookie.options.secure),
            sameSite: normalizeSameSite(cookie.options.sameSite),
          });
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assertNoError(error, `authenticate ${email}`);

  const context = await browser.newContext();
  await context.addCookies([...cookieJar.values()]);
  return context;
}

async function addContactPhone(
  page: import('@playwright/test').Page,
  phone: string,
) {
  await page.getByRole('button', { name: 'Dodaj broj' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kontakt telefon' });
  await dialog.getByLabel('Broj iz Crne Gore').fill(phone);
  await dialog.getByRole('button', { name: 'Sačuvaj broj' }).click();
  await expect(page.getByText('Kontakt telefon je dodat')).toBeVisible();
  await expect(dialog).toBeHidden();
}

async function waitForEmployer(admin: SupabaseClient, ownerId: string) {
  const row = await poll(async () => {
    const { data, error } = await admin
      .from('employers')
      .select('id')
      .eq('owner_id', ownerId)
      .maybeSingle();
    assertNoError(error, 'find employer fixture');
    return data;
  });
  return row.id as string;
}

async function waitForShift(admin: SupabaseClient, employerId: string) {
  return poll(async () => {
    const { data, error } = await admin
      .from('shifts')
      .select('id, status')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertNoError(error, 'find published shift');
    return data;
  });
}

async function waitForAssignment(
  admin: SupabaseClient,
  shiftId: string,
  workerId: string,
) {
  return poll(async () => {
    const { data, error } = await admin
      .from('shift_assignments')
      .select('id, status')
      .eq('shift_id', shiftId)
      .eq('worker_id', workerId)
      .maybeSingle();
    assertNoError(error, 'find shift assignment');
    return data;
  });
}

async function poll<T>(
  operation: () => Promise<T | null>,
  attempts = 20,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await operation();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out while waiting for staging data.');
}

async function cleanupFixtures(admin: SupabaseClient, ids: FixtureIds) {
  if (!ids.employerId && ids.employerUserId) {
    const { data: employer, error } = await admin
      .from('employers')
      .select('id')
      .eq('owner_id', ids.employerUserId)
      .maybeSingle();
    assertNoError(error, 'find employer fixture during cleanup');
    ids.employerId = employer?.id ? String(employer.id) : undefined;
  }

  if (ids.employerId) {
    const { data: shifts, error } = await admin
      .from('shifts')
      .select('id')
      .eq('employer_id', ids.employerId);
    assertNoError(error, 'find fixture shifts during cleanup');
    ids.shiftIds = [
      ...new Set([
        ...ids.shiftIds,
        ...(shifts ?? []).map((shift) => String(shift.id)),
      ]),
    ];
  }

  if (ids.shiftIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await admin
      .from('shift_assignments')
      .select('id')
      .in('shift_id', ids.shiftIds);
    assertNoError(assignmentsError, 'list fixture assignments for cleanup');
    const assignmentIds = (assignments ?? []).map((assignment) =>
      String(assignment.id),
    );
    if (assignmentIds.length > 0) {
      assertNoError(
        (
          await admin
            .from('payment_ledger')
            .delete()
            .in('assignment_id', assignmentIds)
        ).error,
        'delete fixture ledger rows',
      );
      assertNoError(
        (
          await admin
            .from('ratings')
            .delete()
            .in('assignment_id', assignmentIds)
        ).error,
        'delete fixture ratings',
      );
    }
    assertNoError(
      (
        await admin
          .from('shift_assignments')
          .delete()
          .in('shift_id', ids.shiftIds)
      ).error,
      'delete fixture assignments',
    );
    assertNoError(
      (await admin.from('shifts').delete().in('id', ids.shiftIds)).error,
      'delete fixture shifts',
    );
  }

  if (ids.employerId) {
    assertNoError(
      (await admin.from('employers').delete().eq('id', ids.employerId)).error,
      'delete employer fixture',
    );
  }
  if (ids.workerUserId) {
    assertNoError(
      (await admin.auth.admin.deleteUser(ids.workerUserId)).error,
      'delete worker fixture user',
    );
  }
  if (ids.employerUserId) {
    assertNoError(
      (await admin.auth.admin.deleteUser(ids.employerUserId)).error,
      'delete employer fixture user',
    );
  }
}

function assertNoError(
  error: { message: string } | null,
  operation: string,
): asserts error is null {
  if (error) throw new Error(`Could not ${operation}: ${error.message}`);
}

function normalizeSameSite(
  value: boolean | 'lax' | 'strict' | 'none' | undefined,
) {
  if (value === 'strict') return 'Strict' as const;
  if (value === 'none') return 'None' as const;
  return 'Lax' as const;
}

function futureDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
