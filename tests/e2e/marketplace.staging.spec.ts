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

      // Phase 2: the same email can use both capabilities without losing its firm.
      await employerPage.goto('/settings');
      await employerPage.getByRole('button', { name: 'Dodaj radnički profil' }).click();
      await expect(employerPage.getByRole('link', { name: /Otvori (radnički )?profil/ }).first()).toBeVisible();
      await employerPage.goto('/dashboard');
      await expect(employerPage).toHaveURL(/\/settings$/);
      await employerPage.getByRole('link', { name: 'Otvori radnički profil' }).click();
      await expect(employerPage.getByText('Radnički nalog', { exact: true })).toBeVisible();
      await employerPage.goto(`/dashboard?mode=employer&workspace=${ids.employerId}`);
      await expect(employerPage.getByText('Poslodavac', { exact: true })).toBeVisible();

      // Explicit workspace selection and separate phone storage for one owner.
      for (const label of ['Prva', 'Druga']) {
        await workerPage.goto('/settings');
        await workerPage.getByText('Dodaj novu firmu', { exact: true }).click();
        await workerPage.getByLabel('Naziv firme ili lokala').fill(`E2E ${label} ${suffix}`);
        await workerPage.getByRole('button', { name: 'Dodaj firmu', exact: true }).click();
        await expect(workerPage.getByText('Firma je dodata na tvoj nalog.')).toBeVisible();
      }
      const { data: firms, error: firmsError } = await admin.from('employers').select('id, name').eq('owner_id', ids.workerUserId);
      assertNoError(firmsError, 'read worker-owned test firms');
      expect(firms).toHaveLength(2);
      const secondFirm = firms!.find((firm) => firm.name.startsWith('E2E Druga'))!;
      await workerPage.goto(`/dashboard?mode=employer&workspace=${secondFirm.id}`);
      await addContactPhone(workerPage, '067 911 003');
      const { data: personalContact, error: phoneError } = await admin.from('worker_contacts').select('phone').eq('user_id', ids.workerUserId).single();
      assertNoError(phoneError, 'verify personal contact remains separate');
      expect(personalContact?.phone).toBe('+38267911002');
      await workerPage.goto(`/dashboard?mode=employer&workspace=${ids.employerId}`);
      await expect(workerPage).toHaveURL(/\/settings$/);
    } finally {
      await workerContext?.close();
      await employerContext?.close();
      await cleanupFixtures(admin, ids);
    }
  });
});

test('application offer and worker acceptance reveal contacts only after acceptance', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const config = requireStagingTestConfig();
  const workspace = process.env.E2E_APPLICATION_WORKSPACE_ID;
  if (!workspace || !/^[0-9a-f-]{36}$/.test(workspace)) throw new Error('Set E2E_APPLICATION_WORKSPACE_ID to an explicitly enabled isolated staging workspace.');
  const admin = createStagingAdmin(config);
  const { data: business, error } = await admin.from('employers').select('owner_id,name').eq('id', workspace).single();
  assertNoError(error, 'read the approved staging workspace');
  if (!business?.name.startsWith('E2E ')) throw new Error('The approved staging workspace name must start with E2E.');
  const owner = await admin.auth.admin.getUserById(business!.owner_id);
  assertNoError(owner.error, 'read staging workspace owner');
  const email = owner.data.user?.email;
  if (!email) throw new Error('Staging workspace owner must have an email.');
  // Generates a staging-only login token without sending any email.
  const magic = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  assertNoError(magic.error, 'create staging-only owner session');
  const employerContext = await authenticatedContext(browser, config, email, '', magic.data.properties.hashed_token);
  const suffix = `${Date.now()}-${process.pid}`;
  const workerEmail = `e2e-application-${suffix}@smjena.test`;
  const password = `E2E-${crypto.randomUUID()}!`;
  const workerId = await createFixtureUser(admin, { email: workerEmail, password, role: 'worker', fullName: 'E2E Pilot Radnik', city: 'Budva' });
  const workerContext = await authenticatedContext(browser, config, workerEmail, password);
  let shiftId: string | undefined;
  try {
    const employerPage = await employerContext.newPage();
    const workerPage = await workerContext.newPage();
    await employerPage.goto(`/employer/shifts?workspace=${workspace}`);
    const addPhone = employerPage.getByText('Dodaj privatni kontakt telefon', { exact: true });
    if (await addPhone.isVisible()) {
      await addPhone.click();
      await employerPage.getByLabel('Kontakt telefon', { exact: true }).fill('067 911 005');
      await employerPage.getByRole('button', { name: 'Sačuvaj kontakt', exact: true }).click();
      await expect(employerPage.getByText('Kontakt je sačuvan. Nije javan.')).toBeVisible();
    }
    await employerPage.getByText('Objavi novu smjenu', { exact: true }).click();
    await employerPage.getByLabel('Javni naziv lokala').fill('E2E Pilot Hotel');
    await employerPage.getByLabel('Početak — vrijeme u Crnoj Gori').fill(`${futureDate(14)}T12:00`);
    await employerPage.getByLabel('Završetak — vrijeme u Crnoj Gori').fill(`${futureDate(14)}T18:00`);
    await employerPage.getByLabel('Privatna tačna adresa').fill('E2E privatna adresa');
    await employerPage.getByRole('checkbox', { name: /Potvrđujem javni naziv/ }).check();
    await employerPage.getByRole('button', { name: 'Objavi oglas za smjenu' }).click();
    await employerPage.getByRole('link', { name: 'Nastavi →' }).click();
    await expect(employerPage).toHaveURL(/\/employer\/shifts\/[0-9a-f-]+\/applications$/);
    shiftId = new URL(employerPage.url()).pathname.split('/')[3];
    await workerPage.goto(`/shifts/${shiftId}`);
    await expect(workerPage.getByText('E2E privatna adresa')).toHaveCount(0);
    await workerPage.getByRole('button', { name: 'Pošalji prijavu' }).click();
    await workerPage.getByRole('link', { name: /Otvori moju prijavu|Nastavi →/ }).first().click();
    await expect(workerPage.getByText('Prijava poslata', { exact: true })).toBeVisible();
    await expect(workerPage.locator('a[href^="tel:"]')).toHaveCount(0);
    await workerPage.getByText('Dodaj privatni kontakt telefon', { exact: true }).click();
    await workerPage.getByLabel('Kontakt telefon', { exact: true }).fill('067 911 004');
    await workerPage.getByRole('button', { name: 'Sačuvaj kontakt', exact: true }).click();
    await expect(workerPage.getByText('Kontakt je sačuvan. Nije javan.')).toBeVisible();
    await employerPage.reload();
    const applicant = employerPage.getByRole('article').filter({ hasText: 'E2E Pilot Radnik' });
    await applicant.getByRole('button', { name: 'Pošalji ponudu' }).click();
    await expect(employerPage.locator('a[href^="tel:"]')).toHaveCount(0);
    await workerPage.reload();
    await expect(workerPage.getByText('Ponuda čeka odgovor', { exact: true })).toBeVisible();
    await expect(workerPage.locator('a[href^="tel:"]')).toHaveCount(0);
    await workerPage.getByRole('checkbox', { name: /Pročitao\/la sam termin/ }).check();
    await workerPage.getByRole('button', { name: 'Prihvati ponudu', exact: true }).click();
    await expect(workerPage.getByText('E2E privatna adresa', { exact: true })).toBeVisible();
    await expect(workerPage.locator('a[href^="tel:"]')).toHaveCount(1);
    await employerPage.reload();
    await expect(employerPage.locator('a[href="tel:+38267911004"]')).toBeVisible();
    const legacy = await admin.from('shift_assignments').select('id', { count: 'exact', head: true }).eq('shift_id', shiftId);
    assertNoError(legacy.error, 'verify no instant assignment was created');
    expect(legacy.count).toBe(0);
    await workerPage.getByText('Povuci prihvatanje', { exact: true }).click();
    await workerPage.getByRole('checkbox', { name: /Razumijem da gubim/ }).check();
    await workerPage.getByRole('button', { name: 'Potvrdi povlačenje' }).click();
    await expect(workerPage.locator('a[href^="tel:"]')).toHaveCount(0);
    await employerPage.reload();
    await expect(employerPage.locator('a[href^="tel:"]')).toHaveCount(0);
    await employerPage.getByText('Otkaži cijeli oglas', { exact: true }).click();
    await employerPage.getByRole('checkbox', { name: /Otkazujem oglas/ }).check();
    await employerPage.getByRole('button', { name: 'Otkaži oglas i sve aktivne prijave' }).click();
    await expect(employerPage.getByText('Oglas je otkazan.', { exact: true })).toBeVisible();
    await workerPage.goto(`/shifts/${shiftId}`);
    await expect(workerPage.getByRole('heading', { name: 'Oglas nije dostupan.' })).toBeVisible();
  } finally {
    await employerContext.close();
    await workerContext.close();
    // Immutable test history is retained in the isolated staging project only.
    // Do not add a privileged production cleanup endpoint to erase it.
    await testInfo.attach('retained-staging-fixture', { body: JSON.stringify({ workspace, shiftId, workerId }), contentType: 'application/json' });
  }
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
  magicTokenHash?: string,
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
  const { error } = magicTokenHash
    ? await client.auth.verifyOtp({ token_hash: magicTokenHash, type: 'email' })
    : await client.auth.signInWithPassword({ email, password });
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
    // Only workspaces owned by this run's isolated fixture account.
    assertNoError((await admin.from('employers').delete().eq('owner_id', ids.workerUserId)).error, 'delete worker-owned test firms');
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
