import { expect, test, type Page } from "@playwright/test";

const pixel =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23315755'/%3E%3C/svg%3E";

const posts = [
  {
    id: "standard",
    user_id: "admin",
    media_type: "PHOTO",
    media_url: pixel,
    cloudinary_public_id: "standard",
    folder: null,
    text: "Обычная фотография",
    title: "Обычный кадр",
    layout: "STANDARD",
    media_width: 1200,
    media_height: 800,
    country: "Indonesia",
    city: "Bali",
    lat: null,
    lng: null,
    created_at: "2026-09-15T12:00:00.000Z",
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
  },
  {
    id: "featured",
    user_id: "admin",
    media_type: "PHOTO",
    media_url: pixel,
    cloudinary_public_id: "featured",
    folder: null,
    text: "Выделенная фотография",
    title: "Крупный кадр",
    layout: "FEATURED",
    media_width: 1200,
    media_height: 800,
    country: "Indonesia",
    city: "Bali",
    lat: null,
    lng: null,
    created_at: "2026-09-15T11:00:00.000Z",
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
  },
  {
    id: "story",
    user_id: "admin",
    media_type: "STORY",
    media_url: null,
    cloudinary_public_id: null,
    folder: null,
    text: "Текст тестовой истории",
    title: "Тестовая история",
    layout: "STANDARD",
    media_width: null,
    media_height: null,
    country: "Indonesia",
    city: "Bali",
    lat: null,
    lng: null,
    created_at: "2026-09-15T10:00:00.000Z",
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
  },
];

async function mockFeed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("travel_access_token", "responsive-test-token");
  });
  await page.route("**/api-proxy/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({
        json: {
          user: {
            id: "admin",
            username: "admin",
            email: null,
            role: "SUPERADMIN",
            name: "Admin",
            created_at: "2026-09-15T09:00:00.000Z",
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/places")) {
      await route.fulfill({ json: { countries: [] } });
      return;
    }
    if (pathname.endsWith("/posts")) {
      await route.fulfill({
        json: { items: posts, nextCursor: null, hasMore: false },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Not mocked" } });
  });
}

function cardWrapper(page: Page, title: string) {
  return page
    .getByRole("heading", { name: title })
    .locator("xpath=ancestor::div[@data-slot='card']/parent::div");
}

test("phone uses one column and keeps size actions desktop-only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeed(page);
  await page.goto("/?all=true");

  await expect(page.getByRole("heading", { name: "Тестовая история" })).toBeVisible();
  const widths = await Promise.all(
    ["Обычный кадр", "Крупный кадр", "Тестовая история"].map((title) =>
      cardWrapper(page, title).evaluate((element) => element.getBoundingClientRect().width),
    ),
  );
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);

  const actionButtons = page.getByRole("button", { name: "Действия с постом" });
  await actionButtons.first().click();
  await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Сделать крупным|Обычный размер/ })).toBeHidden();
  const menuBounds = await page
    .getByRole("button", { name: "Редактировать" })
    .locator("xpath=parent::div")
    .evaluate((element) => element.getBoundingClientRect().toJSON());
  expect(menuBounds.left).toBeGreaterThanOrEqual(0);
  expect(menuBounds.right).toBeLessThanOrEqual(390);

  await actionButtons.nth(1).click();
  await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(0);

  await actionButtons.first().click();
  await page.locator("main").first().click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(0);
});

test("desktop preserves standard, featured, and story column spans", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockFeed(page);
  await page.goto("/?all=true");

  await expect(page.getByRole("heading", { name: "Тестовая история" })).toBeVisible();
  const standardWidth = await cardWrapper(page, "Обычный кадр").evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const featuredWidth = await cardWrapper(page, "Крупный кадр").evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const storyWidth = await cardWrapper(page, "Тестовая история").evaluate(
    (element) => element.getBoundingClientRect().width,
  );

  expect(featuredWidth).toBeGreaterThan(standardWidth * 1.8);
  expect(Math.abs(storyWidth - standardWidth)).toBeLessThan(2);

  await page.getByRole("button", { name: "Действия с постом" }).first().click();
  await expect(page.getByRole("button", { name: "Сделать крупным" })).toBeVisible();
});
