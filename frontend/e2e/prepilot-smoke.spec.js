import { expect, test } from '@playwright/test';

test('muestra la pantalla de login sin depender de datos de cliente', async ({ page }) => {
  await page.goto('/#/login');

  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
  await expect(page.getByPlaceholder('nombre@ejemplo.com')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /INICIAR/ })).toBeVisible();
});
