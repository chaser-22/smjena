import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('notification worker refuses public requests without invoking delivery', async ({ request }) => {
  for (const token of ['', 'undefined', 'not-a-wakeup-token']) {
    const response = await request.post('/api/internal/application-push', { headers: { 'x-smjena-wakeup': token } });
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  }
  expect((await request.get('/api/internal/application-push')).status()).toBe(405);
});

test.describe('public entry and authentication states', () => {
  test('public screens have no automated WCAG A/AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of [
      '/',
      '/login',
      '/login?intent=register&role=employer',
      '/shifts',
      '/shifts/not-a-real-id',
    ]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });
  test('returning users see a focused email-only login', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: 'Dobro došao nazad.' }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Imam nalog' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Otvaram nalog kao' }),
    ).toHaveCount(0);
    await expect(page.getByLabel('Ime i prezime')).toHaveCount(0);
    await expect(page.getByLabel('Grad')).toHaveCount(0);
  });

  test('new users get an explicit role choice and Montenegro-local registration', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Napravi nalog' }).click();

    await expect(
      page.getByRole('group', { name: 'Otvaram nalog kao' }),
    ).toBeVisible();
    await expect(
      page.getByText('Jedan email je dovoljan.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel('Ime i prezime')).toBeVisible();
    await expect(page.getByLabel('Grad').locator('option')).toHaveCount(24);

    await page
      .getByRole('group', { name: 'Otvaram nalog kao' })
      .getByText('Poslodavac', { exact: true })
      .click();
    await expect(page.getByLabel('Ime odgovorne osobe')).toBeVisible();
    await expect(page.getByLabel('Naziv firme ili lokala')).toBeVisible();
  });

  test('missing authentication codes explain the recovery action', async ({
    page,
  }) => {
    await page.goto('/auth/callback');

    await expect(page).toHaveURL(/\/login\?error=auth_callback$/);
    await expect(
      page.getByText(
        'Link nije važeći ili je istekao. Zatraži novi link ispod.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Pošalji link za prijavu' }),
    ).toBeVisible();
  });

  test('logged-out dashboard visits return to login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login(?:\?next=.*)?$/);
    await expect(page.getByRole('tab', { name: 'Imam nalog' })).toBeVisible();
  });

  test('the login screen fits the viewport without horizontal scrolling', async ({
    page,
  }) => {
    await page.goto('/login');

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('public shift browsing is anonymous, responsive and does not claim availability', async ({ page }) => {
  await page.goto('/shifts');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sljedeću smjenu');
  await expect(page.getByRole('link', { name: 'SMJENA — početna' }).locator('span').first()).toHaveCSS('background-color', 'rgb(186, 38, 48)');
  await expect(page.getByLabel('Grad')).toBeVisible();
  await page.getByLabel('Grad').selectOption('Kotor');
  await page.getByRole('button', { name: 'Prikaži smjene' }).click();
  await expect(page).toHaveURL(/\/shifts\?city=Kotor$/);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Uzmi|Prijavi se/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.goto('/shifts/not-a-real-id');
  await expect(page.getByRole('heading', { name: 'Oglas nije dostupan.' })).toBeVisible();
});

test('settings requires login and callback failures preserve a safe destination', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Dobro došao nazad.' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('next')).toBe('/notifications');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?next=(?:%2F|\/)settings$/);
  await page.goto('/auth/callback?next=/shifts');
  await expect(page).toHaveURL(/\/login\?error=auth_callback&next=%2Fshifts$/);
  await page.goto('/auth/callback?next=//evil.example');
  await expect(page).toHaveURL(/\/login\?error=auth_callback$/);
});

test('application and employer routes require login and preserve their destination', async ({ page }) => {
  for (const path of ['/applications', '/employer/billing', '/employer/billing?workspace=10000000-0000-4000-8000-000000000001', '/employer/shifts', '/employer/shifts/10000000-0000-4000-8000-000000000001/applications']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Dobro došao nazad.' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('next')).toBe(path);
    await page.goto(`/auth/callback?next=${encodeURIComponent(path)}`);
    expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  }
});

test('homepage starts with browsing and preserves employer context through login', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Kad fali',
  );
  await page.getByRole('link', { name: 'Pronađi smjenu', exact: true }).click();
  await expect(page).toHaveURL(/\/shifts$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sljedeću smjenu');
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Pronađi radnika', exact: true })
    .click();
  await expect(page.getByRole('tab', { name: 'Imam nalog' })).toBeVisible();
  await page.getByRole('tab', { name: 'Napravi nalog' }).click();
  await expect(
    page.getByRole('radio', { name: 'Poslodavac', exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('Naziv firme ili lokala')).toBeVisible();
  await page.getByRole('tab', { name: 'Imam nalog' }).click();
  await expect(page.getByLabel('Naziv firme ili lokala')).toHaveCount(0);
});

test('keyboard navigation switches auth intent and opens trust explanations', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Imam nalog' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Napravi nalog' })).toBeFocused();
  await expect(page.getByLabel('Ime i prezime')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Imam nalog' })).toBeFocused();
  await page.goto('/');
  await page.getByText('Ko plaća radnika?', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(/ne izvršava bankovnu uplatu/),
  ).toBeVisible();
});

test('small screens and reduced motion retain the full usable experience', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ['/', '/login', '/login?intent=register&role=employer']) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.goto('/');
  expect(
    await page
      .locator('figure')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  const dispatchStates = await page
    .getByTestId('dispatch-states')
    .locator(':scope > div')
    .evaluateAll((rows) =>
      rows.map((row) => ({
        animation: getComputedStyle(row).animationName,
        opacity: getComputedStyle(row).opacity,
      })),
    );
  expect(dispatchStates).toEqual([
    { animation: 'none', opacity: '1' },
    { animation: 'none', opacity: '1' },
    { animation: 'none', opacity: '1' },
  ]);
});

test('shift signal loops, pauses and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const packet = page.getByTestId('signal-packet');
  expect(
    await packet.evaluate(
      (element) => getComputedStyle(element).animationIterationCount,
    ),
  ).toBe('infinite');
  await page.getByRole('button', { name: 'Pauziraj animaciju' }).click();
  expect(
    await packet.evaluate(
      (element) => getComputedStyle(element).animationPlayState,
    ),
  ).toBe('paused');
  await page.getByRole('button', { name: 'Pokreni animaciju' }).click();
  expect(
    await packet.evaluate(
      (element) => getComputedStyle(element).animationPlayState,
    ),
  ).toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await packet.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await expect(
    page.getByRole('button', { name: 'Pauziraj animaciju' }),
  ).toBeHidden();
});

test('interrupted submissions show pending and recovery without losing the email', async ({
  page,
  baseURL,
}) => {
  test.skip(
    !baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
    'Fault injection runs only on the local app.',
  );
  await page.goto('/login');
  let releaseRequest!: () => void;
  const release = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route('**/login', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await release;
    await route.abort('internetdisconnected');
  });
  await page.getByLabel('Email').fill('network-check@example.test');
  await page.getByRole('button', { name: 'Pošalji link za prijavu' }).click();
  try {
    await expect(
      page.getByRole('button', { name: 'Šaljemo siguran link…' }),
    ).toBeDisabled();
  } finally {
    releaseRequest();
  }
  await expect(page.getByText(/Veza je prekinuta/)).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue(
    'network-check@example.test',
  );
  await expect(
    page.getByRole('button', { name: 'Pošalji link za prijavu' }),
  ).toBeEnabled();
});
