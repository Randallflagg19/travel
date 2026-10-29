import { expect, test, type Page } from "@playwright/test";

const authors = [
  { id: "admin", username: "tapir", name: "Tapir" },
  { id: "friend", username: "friend", name: "Друг" },
];
const stats = { posts: 1, photos: 0, videos: 0, stories: 1 };

async function mockAuthorsAndJournals(page: Page) {
  const requests: Array<{ endpoint: string; authorId: string | null; country: string | null; city: string | null }> = [];
  await page.route("**/api-proxy/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split("/").at(-1);
    if (endpoint === "authors") {
      await route.fulfill({ json: { items: authors } });
      return;
    }
    if (endpoint !== "places" && endpoint !== "posts") {
      await route.fulfill({ status: 404, json: { message: "Not mocked" } });
      return;
    }
    const authorId = url.searchParams.get("authorId");
    requests.push({ endpoint, authorId, country: url.searchParams.get("country"), city: url.searchParams.get("city") });
    const friend = authorId === "friend";
    const country = friend ? "Egypt" : "Indonesia";
    const city = friend ? "Cairo" : "Bali";
    if (endpoint === "places") {
      await route.fulfill({ json: { countries: [{ country, count: 1, stats, cities: [{ city, count: 1, stats }] }] } });
      return;
    }
    await route.fulfill({ json: {
      items: [{
        id: `${authorId}-story`, user_id: authorId, media_type: "STORY",
        media_url: null, cloudinary_public_id: null, folder: null,
        title: friend ? "История друга" : "История Tapir", text: "Тестовая история",
        layout: "STANDARD", media_width: null, media_height: null,
        country, city, lat: null, lng: null, pinned_at: null,
        created_at: "2026-09-15T10:00:00.000Z",
        like_count: 0, comment_count: 0, liked_by_me: false,
      }],
      nextCursor: null, hasMore: false,
    } });
  });
  return requests;
}

async function holdCanonicalResponse(page: Page) {
  let resume!: () => void;
  let markHeld!: () => void;
  const released = new Promise<void>((resolve) => { resume = resolve; });
  const held = new Promise<void>((resolve) => { markHeld = resolve; });
  await page.route(
    (url) => url.pathname === "/" && url.searchParams.has("_rsc") && url.searchParams.get("author") === "admin",
    async (route) => {
      const response = await route.fetch();
      markHeld();
      await released;
      await route.fulfill({ response });
    },
  );
  return { held, resume };
}

for (const width of [390, 1440]) {
  test(`default journal loads before URL canonicalization at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const requests = await mockAuthorsAndJournals(page);
    const canonical = await holdCanonicalResponse(page);
    try {
      await page.goto("/");
      await canonical.held;
      await expect(page.getByRole("heading", { name: "История Tapir" })).toBeVisible({ timeout: 3000 });
      expect(new URL(page.url()).searchParams.has("author")).toBe(false);
      expect(requests.map((r) => r.endpoint).sort()).toEqual(["places", "posts"]);
      expect(requests.every((r) => r.authorId === "admin")).toBe(true);
      if (width === 1440) {
        await expect(page.getByRole("button", { name: /Indonesia/ })).toBeVisible();
      } else {
        await expect(page.getByLabel("Выбрать страну").getByRole("option", { name: "Indonesia" })).toHaveCount(1);
      }
    } finally {
      canonical.resume();
    }
    await expect(page).toHaveURL(/author=admin/);
    await page.waitForLoadState("networkidle");
    expect(requests.map((r) => r.endpoint).sort()).toEqual(["places", "posts"]);
  });
}

test("a default author's city filter loads before URL canonicalization", async ({ page }) => {
  const requests = await mockAuthorsAndJournals(page);
  const canonical = await holdCanonicalResponse(page);
  try {
    await page.goto("/?country=Indonesia&city=Bali");
    await canonical.held;
    await expect(page.getByRole("heading", { name: "История Tapir" })).toBeVisible({ timeout: 3000 });
    expect(requests.find((r) => r.endpoint === "posts")).toEqual({
      endpoint: "posts", authorId: "admin", country: "Indonesia", city: "Bali",
    });
  } finally {
    canonical.resume();
  }
  await expect(page).toHaveURL(/author=admin/);
  expect(new URL(page.url()).searchParams.get("city")).toBe("Bali");
});

test("an unknown author waits for filters to be cleared before loading a journal", async ({ page }) => {
  const requests = await mockAuthorsAndJournals(page);
  const canonical = await holdCanonicalResponse(page);
  try {
    await page.goto("/?author=unknown&country=Egypt&city=Cairo");
    await canonical.held;
    expect(requests).toEqual([]);
    await expect(page.getByRole("heading", { name: "История Tapir" })).toHaveCount(0);
  } finally {
    canonical.resume();
  }
  await expect(page.getByRole("heading", { name: "История Tapir" })).toBeVisible();
  const params = new URL(page.url()).searchParams;
  expect(params.get("author")).toBe("admin");
  expect(params.get("all")).toBe("true");
  expect(params.has("country")).toBe(false);
  expect(params.has("city")).toBe(false);
  expect(requests.map((r) => r.endpoint).sort()).toEqual(["places", "posts"]);
  expect(requests.every((r) => r.authorId === "admin" && !r.country && !r.city)).toBe(true);
});

test("an explicit author and browser history keep journals separate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockAuthorsAndJournals(page);
  await page.goto("/?author=friend&all=true");
  await expect(page.getByRole("heading", { name: "История друга" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Egypt/ })).toBeVisible();
  expect(requests.every((r) => r.authorId === "friend")).toBe(true);

  await page.getByRole("navigation", { name: "Авторы" }).getByRole("button", { name: "Tapir", exact: true }).click();
  await expect(page.getByRole("heading", { name: "История Tapir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История друга" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Indonesia/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Egypt/ })).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "История друга" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История Tapir" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Egypt/ })).toBeVisible();

  await page.goForward();
  await expect(page.getByRole("heading", { name: "История Tapir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История друга" })).toHaveCount(0);
});
