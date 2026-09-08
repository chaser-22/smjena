import { expect, test } from '@playwright/test';

test.describe('public entry and authentication states', () => {
  test('returning users see a focused email-only login', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: 'Dobro došao u SMJENU' }),
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

  test('expired or reused authentication links explain the recovery action', async ({
    page,
  }) => {
    await page.goto('/auth/callback');

    await expect(page).toHaveURL(/\/login\?error=auth_callback$/);
    await expect(
      page.getByText('Link nije važeći ili je istekao. Zatraži novi link ispod.'),
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
