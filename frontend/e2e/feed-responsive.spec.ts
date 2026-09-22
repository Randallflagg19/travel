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
    pinned_at: null,
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
    pinned_at: null,
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
    pinned_at: null,
    created_at: "2026-09-15T10:00:00.000Z",
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
  },
];

async function mockFeed(page: Page) {
  let visitorPromoted = false;
  await page.addInitScript(() => {
    localStorage.setItem("travel_access_token", "responsive-test-token");
  });
  await page.route("**/api-proxy/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith("/authors/candidates")) {
      await route.fulfill({ json: { items: visitorPromoted ? [] : [{ id: "visitor", username: "visitor", name: "Гость" }] } });
      return;
    }
    if (pathname.endsWith("/authors/visitor/role")) {
      expect(route.request().postDataJSON()).toEqual({ role: "AUTHOR" });
      visitorPromoted = true;
      await route.fulfill({ json: { user: { id: "visitor", username: "visitor", name: "Гость", role: "AUTHOR" } } });
      return;
    }
    if (pathname.endsWith("/authors")) {
      await route.fulfill({
        json: {
          items: [
            { id: "admin", username: "tapir", name: "Tapir" },
            { id: "friend", username: "friend", name: "Друг" },
            ...(visitorPromoted ? [{ id: "visitor", username: "visitor", name: "Гость" }] : []),
          ],
        },
      });
      return;
    }
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
      if (requestUrl.searchParams.get("authorId") === "friend") {
        await route.fulfill({
          json: {
            countries: [{
              country: "China",
              count: 1,
              stats: { posts: 1, photos: 1, videos: 0, stories: 0 },
              cities: [{ city: "Beijing", count: 1, stats: { posts: 1, photos: 1, videos: 0, stories: 0 } }],
            }],
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          countries: [
            {
              country: "Indonesia",
              count: 4,
              stats: { posts: 4, photos: 2, videos: 1, stories: 1 },
              cities: [
                {
                  city: "Bali",
                  count: 3,
                  stats: { posts: 3, photos: 2, videos: 0, stories: 1 },
                },
              ],
            },
            {
              country: "Thailand",
              count: 2,
              stats: { posts: 2, photos: 1, videos: 1, stories: 0 },
              cities: [],
            },
          ],
        },
      });
      return;
    }
    if (pathname.endsWith("/posts")) {
      if (requestUrl.searchParams.get("authorId") === "friend") {
        await route.fulfill({ json: { items: [], nextCursor: null, hasMore: false } });
        return;
      }
      await route.fulfill({
        json: { items: posts, nextCursor: null, hasMore: false },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Not mocked" } });
  });
}

test("superadmin explicitly grants an author role", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockFeed(page);
  await page.goto("/?all=true");
  await page.getByRole("button", { name: "Управление авторами" }).click();
  await expect(page.getByRole("dialog", { name: "Управление авторами" })).toBeVisible();
  await expect(page.getByText("@visitor")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Сделать автором" }).click();
  await expect(page.getByText("Пока нет пользователей, ожидающих доступа.")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("navigation", { name: "Авторы" }).getByRole("button", { name: "Гость" })).toBeVisible();
});

test("switching authors isolates feed and places", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockFeed(page);
  await page.goto("/?all=true");

  await expect(page.getByRole("heading", { name: "Тестовая история" })).toBeVisible();
  await page.getByRole("navigation", { name: "Авторы" }).getByRole("button", { name: "Друг" }).click();
  await expect(page).toHaveURL(/author=friend/);
  await expect(page.getByRole("heading", { name: "Тестовая история" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /China/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Indonesia/ })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Авторы" }).getByRole("button", { name: "Tapir" }).click();
  await expect(page.getByRole("heading", { name: "Тестовая история" })).toBeVisible();
});

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
  await expect(page.locator("span:visible", { hasText: "3 фото" })).toBeVisible();
  await expect(page.locator("span:visible", { hasText: "2 видео" })).toBeVisible();
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

test("hero counters follow country and city selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeed(page);

  await page.goto("/?country=Indonesia");
  await expect(page.locator("span:visible", { hasText: "2 фото" })).toBeVisible();
  await expect(page.locator("span:visible", { hasText: "1 видео" })).toBeVisible();

  await page.goto("/?country=Indonesia&city=Bali");
  await expect(page.locator("span:visible", { hasText: "2 фото" })).toBeVisible();
  await expect(page.locator("span:visible", { hasText: "0 видео" })).toBeVisible();
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
