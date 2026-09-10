import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public entry and authentication states', () => {
  test('public screens have no automated WCAG A/AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of [
      '/',
      '/login',
      '/login?intent=register&role=employer',
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
      page.getByText('Uloga se trajno veže za ovaj email.'),
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

    await expect(page).toHaveURL(/\/login$/);
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

test('homepage role entrances carry the choice into registration', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tvoj grad.',
  );
  await page.getByRole('link', { name: 'Pronađi smjenu', exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'Radnik', exact: true }),
  ).toBeChecked();
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Pronađi radnika', exact: true })
    .click();
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
  await page.getByText('Kako se prati naknada?', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(/Evidencija sama ne izvršava bankovnu uplatu/),
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
  const ticketRows = await page.locator('figure li').evaluateAll((rows) =>
    rows.map((row) => ({
      animation: getComputedStyle(row).animationName,
      opacity: getComputedStyle(row).opacity,
    })),
  );
  expect(ticketRows).toEqual([
    { animation: 'none', opacity: '1' },
    { animation: 'none', opacity: '1' },
    { animation: 'none', opacity: '1' },
  ]);
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
