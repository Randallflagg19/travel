import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("1. home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Места" }).first()).toBeVisible();
  });

  test("2. login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Вход", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Войти|Входим/ })).toBeVisible();
  });

  test("3. register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Регистрация", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("textbox", { name: "tapir", exact: true })).toBeVisible();
  });

  test("4. feed shows when «Все посты» selected", async ({ page }) => {
    await page.goto("/?all=true");
    await expect(page.getByRole("heading", { name: "Все посты" })).toBeVisible();
    await expect(
      page.getByText(/Загрузка|Пока пусто|Конец ленты|Прокрути ниже/i),
    ).toBeVisible({ timeout: 15000 });
  });

  test("5. like persists after refresh (requires E2E_TEST_LOGIN)", async ({ page }) => {
    const login = process.env.E2E_TEST_LOGIN;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!login || !password, "Set E2E_TEST_LOGIN and E2E_TEST_PASSWORD to run");

    await page.goto("/login");
    await page.getByPlaceholder(/you@example|tapir/).fill(login!);
    await page.getByPlaceholder("•••").fill(password!);
    await page.getByRole("button", { name: /Войти|Входим/ }).click();
    await expect(page).toHaveURL(/\//, { timeout: 10000 });

    await page.goto("/?all=true");
    await expect(page.getByRole("heading", { name: "Все посты" })).toBeVisible({ timeout: 10000 });

    const likeButton = page.getByRole("button", { name: "Лайкнуть" }).first();
    const hasLikeButton = await likeButton.isVisible().catch(() => false);
    if (hasLikeButton) {
      await likeButton.click();
      await expect(page.getByRole("button", { name: "Снять лайк" }).first()).toBeVisible({ timeout: 5000 });
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: "Все посты" })).toBeVisible({ timeout: 10000 });
    if (hasLikeButton) {
      await expect(page.getByRole("button", { name: "Снять лайк" }).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
