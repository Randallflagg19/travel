import { expect, test } from "@playwright/test";

for (const { status, serverMessage, message } of [
  {
    status: 401,
    serverMessage: "Invalid credentials",
    message: "Неверный логин или пароль.",
  },
  {
    status: 503,
    serverMessage: "Service unavailable",
    message: "Не удалось войти. Попробуй ещё раз.",
  },
]) {
  test(`login shows a user-facing message for HTTP ${status}`, async ({ page }) => {
    await page.route("**/api-proxy/auth/login", (route) =>
      route.fulfill({ status, json: { message: serverMessage } }),
    );

    await page.goto("/login");
    const form = page.locator("form");
    await form.getByPlaceholder("you@example.com или tapir").fill("test_author");
    await form.getByPlaceholder("•••").fill("test-password");
    const submit = form.getByRole("button", { name: "Войти", exact: true });
    await submit.click();

    await expect(form.getByRole("alert")).toHaveText(message);
    await expect(submit).toBeEnabled();
  });
}
