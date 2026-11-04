import { expect, test, type Page } from "@playwright/test";
import type { ApiPost, ApiPostMedia } from "../src/shared/api/api";
import { selectFeedMediaStats } from "../src/features/feed/model/feed-media-stats";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

const authorId = "00000000-0000-4000-8000-000000000010";
const pixel = (color = "315755") => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23${color}'/%3E%3C/svg%3E`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
function image(name: string) { return { name, mimeType: "image/png", buffer: png }; }
function post(id = "old", title = "Старая запись"): ApiPost {
  return { id, user_id: authorId, media_type: "PHOTO", media_url: pixel(), cloudinary_public_id: null,
    folder: null, title, text: "Описание", layout: "STANDARD", media_width: 1200, media_height: 800,
    country: "Thailand", city: null, lat: null, lng: null, pinned_at: null,
    created_at: "2026-11-03T12:00:00.000Z", like_count: 5, comment_count: 2, liked_by_me: true };
}

async function mockMedia(page: Page, options: {
  failUpload?: number; losePublish?: boolean; loseUpload?: boolean; posts?: ApiPost[]; cities?: string[];
} = {}) {
  const state = {
    posts: options.posts ?? [post()], uploads: new Map<string, { type: "PHOTO" | "VIDEO"; ready: boolean }>(),
    reserveOrder: [] as string[], cloudRequests: [] as string[], mediaRequests: [] as string[],
    publications: [] as { uploadIds: string[]; title: string; text: string; country: string; city: string }[],
    stories: [] as { mediaType: string; title: string; text: string; country?: string; city?: string }[],
    created: 0, failed: false, lost: false, session: "", deleted: [] as string[],
    likeMethods: [] as string[], postQueries: [] as string[],
  };
  await page.addInitScript(() => localStorage.setItem("travel_access_token", "media-test-token"));
  await page.route("https://api.cloudinary.com/**", async (route) => {
    const publicId = route.request().postData()?.match(/name="public_id"\r\n\r\n([^\r\n]+)/)?.[1];
    if (!publicId) throw new Error("Missing reserved public ID");
    const id = publicId.split("/").at(-1)!;
    state.cloudRequests.push(id);
    if (options.failUpload === state.cloudRequests.length && !state.failed) {
      state.failed = true;
      await route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "Upload failed" } });
      return;
    }
    state.uploads.get(id)!.ready = true;
    if (options.loseUpload && !state.lost) { state.lost = true; await route.abort(); return; }
    await route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: { public_id: publicId } });
  });
  await page.route("**/api-proxy/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api-proxy/", "");
    if (path.startsWith("media/")) state.mediaRequests.push(path);
    if (path === "auth/me") {
      await route.fulfill({ json: { user: { id: authorId, username: "traveller", name: "Автор", role: "ADMIN" } } }); return;
    }
    if (path === "authors") {
      await route.fulfill({ json: { items: [{ id: authorId, username: "traveller", name: "Автор" }] } }); return;
    }
    if (path === "places") {
      await route.fulfill({ json: { countries: [{ country: "Thailand", count: state.posts.length,
        stats: { posts: state.posts.length, photos: 2, videos: 1, stories: 0 },
        cities: (options.cities ?? ["Chiang Mai"]).map((city) => ({
          city, count: state.posts.length, stats: { posts: state.posts.length, photos: 2, videos: 1, stories: 0 },
        })) }] } }); return;
    }
    if (path === "posts" && request.method() === "POST") {
      const body = request.postDataJSON();
      state.stories.push(body);
      const story: ApiPost = { ...post(`story-${state.stories.length}`, body.title), media_type: "STORY",
        media_url: "", text: body.text, country: body.country ?? null, city: body.city ?? null };
      state.posts.unshift(story);
      await route.fulfill({ json: { post: story } }); return;
    }
    if (path === "posts") {
      state.postQueries.push(url.search);
      const country = url.searchParams.get("country");
      const city = url.searchParams.get("city");
      const items = state.posts.filter((item) => (!country || item.country === country) && (!city || item.city === city));
      await route.fulfill({ json: { items, nextCursor: null, hasMore: false } }); return;
    }
    const session = path.match(/^media\/sessions\/([^/]+)$/);
    if (session) {
      state.session = session[1];
      await route.fulfill({ json: request.method() === "DELETE" ? { postId: state.created ? "new-post" : null } : { id: session[1] } }); return;
    }
    const reserve = path.match(/^media\/sessions\/[^/]+\/uploads\/([^/]+)$/);
    if (reserve) {
      const id = reserve[1];
      const body = request.postDataJSON();
      if (!state.uploads.has(id)) { state.uploads.set(id, { type: body.mediaType, ready: false }); state.reserveOrder.push(id); }
      await route.fulfill({ json: { cloudName: "test", apiKey: "key", signature: "signed", timestamp: 1,
        params: { public_id: `travel/test/${id}`, overwrite: false },
        resourceType: body.mediaType === "PHOTO" ? "image" : "video", ready: state.uploads.get(id)!.ready } }); return;
    }
    const complete = path.match(/^media\/sessions\/[^/]+\/uploads\/([^/]+)\/complete$/);
    if (complete) {
      await route.fulfill({ json: { ready: state.uploads.get(complete[1])?.ready ?? false } }); return;
    }
    if (/^media\/sessions\/[^/]+\/publish$/.test(path)) {
      const body = request.postDataJSON();
      state.publications.push(body);
      if (!state.created) {
        const attachments: ApiPostMedia[] = body.uploadIds.map((id: string, position: number) => ({
          id, position, media_type: state.uploads.get(id)!.type, media_url: pixel(position ? "81663f" : "315755"),
          cloudinary_public_id: null, media_width: 1200, media_height: 800,
        }));
        const cover = attachments[0];
        state.posts.unshift({ ...post("new-post", body.title), ...cover, id: "new-post", text: body.text,
          country: body.country || null, city: body.city || null, attachments });
        state.created++;
      }
      if (options.losePublish && state.publications.length === 1) { await route.abort(); return; }
      await route.fulfill({ json: { postId: "new-post" } }); return;
    }
    if (path.endsWith("/like")) {
      state.likeMethods.push(request.method());
      const target = state.posts.find((post) => post.id === path.split("/")[1])!;
      const liked = request.method() === "POST";
      if (target.liked_by_me !== liked) target.like_count += liked ? 1 : -1;
      target.liked_by_me = liked;
      await route.fulfill({ json: { ok: true } }); return;
    }
    if (path.startsWith("posts/") && request.method() === "PATCH") {
      const target = state.posts.find((post) => post.id === path.split("/")[1])!;
      Object.assign(target, request.postDataJSON());
      // Deliberately emulate the old server's incomplete response too.
      await route.fulfill({ json: { post: { ...target, like_count: 0, comment_count: 0, liked_by_me: undefined } } }); return;
    }
    if (path.startsWith("posts/") && request.method() === "DELETE") {
      const id = path.split("/")[1];
      state.deleted.push(id);
      state.posts = state.posts.filter((post) => post.id !== id);
      await route.fulfill({ json: { ok: true, pendingMediaDeletions: 0 } }); return;
    }
    await route.fulfill({ status: 404, json: { message: `Unexpected test request: ${path}` } });
  });
  return state;
}

async function openComposer(page: Page, selection = "all=true") {
  await page.goto(`/?author=${authorId}&${selection}`);
  await page.locator('button[aria-label="Новая публикация"]:visible').click();
  return page.getByRole("dialog", { name: "Новая публикация", exact: true });
}

test("files stay local until Publish; order, cover and removal are preserved", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockMedia(page);
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("first.png"),
    { name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("test video") }, image("remove.png")]);
  await dialog.getByRole("button", { name: "Переместить clip.mp4 раньше" }).click();
  await dialog.getByRole("button", { name: "Убрать remove.png" }).click();
  await dialog.getByLabel("Название").fill("День со слонами");
  await dialog.getByLabel("Описание").fill("Общий рассказ о поездке");
  expect(state.cloudRequests).toHaveLength(0);
  expect(state.mediaRequests).toHaveLength(0);
  await expect(dialog.getByRole("listitem").first()).toContainText("clip.mp4");
  await expect(dialog.getByRole("listitem").first()).toContainText("Обложка");
  await dialog.getByRole("heading", { name: "Новая публикация", exact: true }).evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.screenshot({ path: info.outputPath("composer-mobile.png"), fullPage: true });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.created).toBe(1);
  expect(state.cloudRequests).toHaveLength(2);
  expect(state.publications[0].uploadIds).toEqual(state.reserveOrder);
  expect(state.reserveOrder.map((id) => state.uploads.get(id)!.type)).toEqual(["VIDEO", "PHOTO"]);
  expect(state.publications[0].text).toBe("Общий рассказ о поездке");
  expect(state.publications[0]).toMatchObject({ country: "", city: "" });
});

for (const context of [
  { selection: "", country: "", city: "" },
  { selection: "all=true", country: "", city: "" },
  { selection: "all=true&country=Thailand&city=Chiang%20Mai", country: "", city: "" },
  { selection: "country=Thailand", country: "Thailand", city: "" },
  { selection: "country=Thailand&city=Chiang%20Mai", country: "Thailand", city: "Chiang Mai" },
]) {
  test(`publication inherits the current location without editable fields: ${context.selection}`, async ({ page }) => {
    const state = await mockMedia(page);
    const dialog = await openComposer(page, context.selection);
    await expect(dialog.getByRole("textbox", { name: "Страна", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("textbox", { name: "Город", exact: true })).toHaveCount(0);
    await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("trip.png")]);
    await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.publications[0]).toMatchObject({ country: context.country, city: context.city });
  });

  test(`story inherits the current location: ${context.selection}`, async ({ page }) => {
    const state = await mockMedia(page);
    await page.goto(`/?author=${authorId}&${context.selection}`);
    await page.locator('button[aria-label="Новая история"]:visible').click();
    const dialog = page.getByRole("dialog", { name: "Новая история", exact: true });
    await dialog.getByPlaceholder("Заголовок", { exact: true }).fill("История поездки");
    await dialog.getByPlaceholder("Расскажите, что произошло…").fill("Рассказ о путешествии");
    await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.stories).toHaveLength(1);
    expect(state.stories[0]).toEqual({ mediaType: "STORY", title: "История поездки", text: "Рассказ о путешествии",
      ...(context.country ? { country: context.country } : {}), ...(context.city ? { city: context.city } : {}) });
    expect(state.cloudRequests).toHaveLength(0);
  });
}

test("an unavailable publication endpoint shows a clear error and allows cancelling locally", async ({ page }) => {
  const state = await mockMedia(page);
  await page.route("**/api-proxy/media/sessions/*", async (route) => {
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({ status: 404, json: { message: `Cannot PUT /api/media/sessions/${route.request().url().split("/").at(-1)}` } });
  });
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("trip.png")]);
  await dialog.getByLabel("Название").fill("Поездка");
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Публикация с фото и видео пока недоступна на сервере. Попробуйте позже.");
  await expect(dialog.getByLabel("Название")).toHaveValue("Поездка");
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  expect(state.cloudRequests).toHaveLength(0);
  expect(state.created).toBe(0);
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("a failed sixth upload preserves the five completed files and retries only the sixth", async ({ page }) => {
  const state = await mockMedia(page, { failUpload: 6 });
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles(Array.from({ length: 6 }, (_, index) => image(`${index + 1}.png`)));
  await dialog.getByLabel("Название").fill("Шесть кадров");
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Публикация пока не создана");
  await expect(dialog.getByText("Загружено", { exact: true })).toHaveCount(5);
  expect(state.created).toBe(0);
  await expect(dialog.getByLabel("Название")).toHaveValue("Шесть кадров");
  await dialog.getByRole("button", { name: "Повторить загрузку и опубликовать" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.cloudRequests).toHaveLength(7);
  expect(new Set(state.cloudRequests.slice(0, 5)).size).toBe(5);
  expect(state.cloudRequests[6]).toBe(state.cloudRequests[5]);
  expect(state.created).toBe(1);
  expect(state.publications[0].uploadIds).toHaveLength(6);
});

test("a lost publication response retries the same content without reuploading or duplicating", async ({ page }) => {
  const state = await mockMedia(page, { losePublish: true });
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("first.png")]);
  await dialog.getByLabel("Название").fill("Один пост");
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("подтверждение публикации");
  await expect(dialog.getByLabel("Название")).toBeDisabled();
  await dialog.getByRole("button", { name: "Повторить публикацию", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.created).toBe(1);
  expect(state.publications).toHaveLength(2);
  expect(state.publications[1]).toEqual(state.publications[0]);
  expect(state.cloudRequests).toHaveLength(1);
});

test("a lost upload response is recovered by verification, without uploading the file again", async ({ page }) => {
  const state = await mockMedia(page, { loseUpload: true });
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("first.png")]);
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.created).toBe(1);
  expect(state.cloudRequests).toHaveLength(1);
});

test("eleven files are rejected locally and ten files can be published", async ({ page }) => {
  const state = await mockMedia(page);
  const dialog = await openComposer(page);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles(Array.from({ length: 11 }, (_, index) => image(`${index}.png`)));
  await expect(dialog.getByRole("alert")).toContainText("не больше 10");
  await expect(dialog.getByRole("listitem")).toHaveCount(0);
  expect(state.mediaRequests).toHaveLength(0);
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles(Array.from({ length: 10 }, (_, index) => image(`${index}.png`)));
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.publications[0].uploadIds).toHaveLength(10);
});

test("editing text and layout preserves reactions and allows removing my like", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await mockMedia(page);
  await page.goto(`/?author=${authorId}&all=true`);
  await page.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Редактировать запись" });
  await dialog.getByLabel("Название", { exact: true }).fill("Новое название");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Снять лайк", exact: true })).toHaveText("5");
  await expect(page.getByRole("button", { name: "Комментарии", exact: true })).toHaveText("2");
  await page.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Сделать крупным", exact: true }).click();
  await expect.poll(() => state.posts[0].layout).toBe("FEATURED");
  await expect(page.getByRole("button", { name: "Снять лайк", exact: true })).toHaveText("5");
  await page.getByRole("button", { name: "Снять лайк", exact: true }).click();
  await expect.poll(() => state.likeMethods).toEqual(["DELETE"]);
  await expect(page.getByRole("button", { name: "Лайкнуть", exact: true })).toHaveText("4");
  await expect(page.getByRole("heading", { name: "Новое название" })).toBeVisible();
});

test("card and viewer navigate within the post, then explicitly move to the next publication", async ({ page }, info) => {
  const attachments: ApiPostMedia[] = [0, 1, 2].map((position) => ({ id: `frame-${position}`, position,
    media_type: "PHOTO", media_url: pixel(["315755", "81663f", "596181"][position]), cloudinary_public_id: null, media_width: 1200, media_height: 800 }));
  await mockMedia(page, { posts: [{ ...post("carousel", "Карусель"), attachments }, post("next", "Следующая запись")] });
  await page.goto(`/?author=${authorId}&all=true`);
  const cardThumbnails = page.getByRole("group", { name: "Миниатюры публикации" });
  await expect(cardThumbnails.getByRole("button")).toHaveCount(3);
  await cardThumbnails.getByRole("button", { name: "Показать кадр 3: фото", exact: true }).click();
  await expect(page.getByLabel("Кадр публикации")).toHaveText("3 / 3");
  await cardThumbnails.getByRole("button", { name: "Показать кадр 1: фото", exact: true }).click();
  await page.getByRole("button", { name: "Следующий кадр в карточке" }).click();
  await expect(page.getByLabel("Кадр публикации")).toHaveText("2 / 3");
  await expect(cardThumbnails.getByRole("button", { name: "Показать кадр 2: фото", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-carousel] button[aria-label="Открыть фото"]').click();
  const viewer = page.getByRole("dialog", { name: "Просмотр медиа" });
  await expect(viewer.getByText("Фото · 2 / 3", { exact: true })).toBeVisible();
  const viewerThumbnails = viewer.getByRole("group", { name: "Миниатюры публикации" });
  await expect(viewerThumbnails.getByRole("button", { name: "Показать кадр 2: фото", exact: true })).toHaveAttribute("aria-pressed", "true");
  await viewerThumbnails.getByRole("button", { name: "Показать кадр 1: фото", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("Фото · 3 / 3", { exact: true })).toBeVisible();
  await expect(viewerThumbnails.getByRole("button", { name: "Показать кадр 3: фото", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.getByRole("button", { name: "Следующее фото или видео", exact: true })).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("Последний кадр публикации")).toBeVisible();
  await page.screenshot({ path: info.outputPath("carousel-viewer.png"), fullPage: true });
  await viewer.getByRole("button", { name: "Следующая публикация", exact: true }).click();
  await expect(viewer.getByRole("heading", { name: "Следующая запись", exact: true })).toBeVisible();
  await expect(viewerThumbnails).toHaveCount(0);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`ten thumbnails scroll independently and follow frame selection at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const photos = ["/hero-photos/egypt-giza-pyramid.jpg", "/hero-photos/indonesia-bali-temple.jpg", "/hero-photos/thailand-bangkok-giraffes.jpg"];
    const attachments: ApiPostMedia[] = Array.from({ length: 10 }, (_, position) => ({ id: `ten-${position}`, position,
      media_type: "PHOTO", media_url: photos[position % photos.length], cloudinary_public_id: null, media_width: 1200, media_height: 800 }));
    await mockMedia(page, { posts: [{ ...post("ten", "День в путешествии"), media_url: attachments[0].media_url, attachments }] });
    await page.goto(`/?author=${authorId}&all=true`);
    const strip = page.getByRole("group", { name: "Миниатюры публикации" });
    await expect(strip.getByRole("button")).toHaveCount(10);
    expect(await strip.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    await strip.evaluate((node) => {
      const start = new Touch({ identifier: 1, target: node, clientX: 280, clientY: 20 });
      const end = new Touch({ identifier: 1, target: node, clientX: 80, clientY: 20 });
      node.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
      node.scrollLeft = node.scrollWidth;
      node.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await expect(page.getByLabel("Кадр публикации")).toHaveText("1 / 10");
    await strip.getByRole("button", { name: "Показать кадр 10: фото", exact: true }).click();
    await expect(page.getByLabel("Кадр публикации")).toHaveText("10 / 10");
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "День в путешествии", exact: true }) });
    await card.screenshot({ path: info.outputPath("thumbnails-card.png") });
    await page.getByRole("button", { name: "Открыть фото", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "Просмотр медиа" });
    const viewerStrip = viewer.getByRole("group", { name: "Миниатюры публикации" });
    await expect(viewer.getByText("Фото · 10 / 10", { exact: true })).toBeVisible();
    await viewerStrip.getByRole("button", { name: "Показать кадр 1: фото", exact: true }).click();
    for (let index = 1; index < 10; index++) await page.keyboard.press("ArrowRight");
    await expect(viewerStrip.getByRole("button", { name: "Показать кадр 10: фото", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => viewerStrip.evaluate((node) => {
      const active = node.querySelector('[aria-pressed="true"]')!.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      return active.left >= bounds.left && active.right <= bounds.right + 1;
    })).toBe(true);
    expect(await viewer.getByLabel("Медиа", { exact: true }).evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(120);
    await page.screenshot({ path: info.outputPath("thumbnails-viewer.png") });
    const third = viewerStrip.getByRole("button", { name: "Показать кадр 3: фото", exact: true });
    await third.focus();
    await third.press("Enter");
    await expect(viewer.getByText("Фото · 3 / 10", { exact: true })).toBeVisible();
    expect(await viewer.evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("thumbnails use small photos and video posters without loading the video", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://res.cloudinary.com/thumbnail-test/**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: "image/png", body: png });
  });
  const attachments: ApiPostMedia[] = [
    { id: "thumb-photo", position: 0, media_type: "PHOTO", media_url: "https://res.cloudinary.com/thumbnail-test/image/upload/v1/photo.jpg", cloudinary_public_id: "photo", media_width: 1200, media_height: 800 },
    { id: "thumb-video", position: 1, media_type: "VIDEO", media_url: "https://res.cloudinary.com/thumbnail-test/video/upload/v1/clip.mp4", cloudinary_public_id: "clip", media_width: 1200, media_height: 800 },
  ];
  await mockMedia(page, { posts: [{ ...post("thumbs"), media_url: attachments[0].media_url, attachments }] });
  await page.goto(`/?author=${authorId}&all=true`);
  const strip = page.getByRole("group", { name: "Миниатюры публикации" });
  await expect(strip.getByRole("button", { name: "Показать кадр 1: фото", exact: true }).locator("img")).toHaveAttribute("src", /w_320,c_limit/);
  const poster = strip.getByRole("button", { name: "Показать кадр 2: видео", exact: true }).locator("img");
  await expect(poster).toHaveAttribute("src", /so_0,f_jpg,q_auto,w_160,c_limit\/v1\/clip\.jpg$/);
  await expect.poll(() => poster.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.locator("video")).toHaveCount(0);
  expect(requests.some((url) => url.endsWith(".mp4"))).toBe(false);
});

test("failed edit A leaves successful edit B and a newly loaded page intact", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const initial = Array.from({ length: 9 }, (_, index) => post(`post-${index}`, `Запись ${index}`));
  await mockMedia(page, { posts: initial });
  let fail!: () => void;
  const failure = new Promise<void>((resolve) => { fail = resolve; });
  await page.route("**/api-proxy/posts/post-0", async (route) => {
    await failure;
    await route.fulfill({ status: 500, json: { message: "Failed A" } });
  });
  let pageTwo = false;
  await page.route((url) => url.pathname === "/api-proxy/posts", async (route) => {
    pageTwo = Boolean(new URL(route.request().url()).searchParams.get("cursor"));
    await route.fulfill({ json: { items: pageTwo ? [post("page-two", "Новая страница")] : initial,
      nextCursor: pageTwo ? null : "page-two", hasMore: !pageTwo } });
  });
  let failureNotified = false;
  page.on("dialog", (dialog) => { failureNotified = true; void dialog.dismiss(); });
  await page.goto(`/?author=${authorId}&all=true`);
  const cardA = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Запись 0", exact: true }) });
  await cardA.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Сделать крупным", exact: true }).click();
  const cardB = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Запись 1", exact: true }) });
  await cardB.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Редактировать запись" });
  await dialog.getByLabel("Название", { exact: true }).fill("Успешное изменение B");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("heading", { name: "Новая страница", exact: true })).toBeVisible();
  fail();
  await expect.poll(() => failureNotified).toBe(true);
  await expect(page.getByRole("heading", { name: "Успешное изменение B", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Новая страница", exact: true })).toHaveCount(1);
  expect(pageTwo).toBe(true);
});

test("mixed carousel supports swipe and stops the old video when the frame changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockMedia(page, { posts: [] });
  await page.goto(`/?author=${authorId}&all=true`);
  // Generate a playable local fixture; no external video or upload service is used.
  const videoUrl = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160; canvas.height = 90;
    const context = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start();
    let tick = 0;
    const animation = setInterval(() => {
      context.fillStyle = tick++ % 2 ? "#315755" : "#81663f";
      context.fillRect(0, 0, 160, 90);
    }, 80);
    await new Promise((resolve) => setTimeout(resolve, 800));
    recorder.stop();
    await stopped;
    clearInterval(animation);
    stream.getTracks().forEach((track) => track.stop());
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
    });
  });
  const attachments: ApiPostMedia[] = [0, 1, 2].map((position) => ({ id: `mixed-${position}`, position,
    media_type: position === 1 ? "VIDEO" : "PHOTO", media_url: position === 1 ? videoUrl : pixel(position ? "81663f" : "315755"),
    cloudinary_public_id: null, media_width: 160, media_height: 90 }));
  state.posts = [{ ...post("mixed", "Смешанная карусель"), attachments }];
  await page.reload();
  await page.getByRole("button", { name: "Открыть фото", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Просмотр медиа" });
  await viewer.getByLabel("Медиа", { exact: true }).evaluate((node) => {
    const start = new Touch({ identifier: 1, target: node, clientX: 300, clientY: 250 });
    const end = new Touch({ identifier: 1, target: node, clientX: 100, clientY: 250 });
    node.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
    node.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], targetTouches: [], changedTouches: [end] }));
  });
  await expect(viewer.getByText("Видео · 2 / 3", { exact: true })).toBeVisible();
  const thumbnails = viewer.getByRole("group", { name: "Миниатюры публикации" });
  await expect(thumbnails.getByRole("button", { name: "Показать кадр 2: видео", exact: true })).toHaveAttribute("aria-pressed", "true");
  const video = viewer.getByLabel("Видео поста");
  await video.evaluate(async (node: HTMLVideoElement) => {
    node.loop = true;
    await node.play();
    (window as unknown as { previousVideo: HTMLVideoElement }).previousVideo = node;
  });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  await thumbnails.getByRole("button", { name: "Показать кадр 2: видео", exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  await thumbnails.getByRole("button", { name: "Показать кадр 3: фото", exact: true }).click();
  await expect(viewer.getByText("Фото · 3 / 3", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { previousVideo: HTMLVideoElement }).previousVideo.paused)).toBe(true);
  await expect(viewer.getByLabel("Видео поста")).toHaveCount(0);
  await thumbnails.getByRole("button", { name: "Показать кадр 2: видео", exact: true }).click();
  await video.evaluate(async (node: HTMLVideoElement) => {
    node.loop = true;
    await node.play();
    (window as unknown as { previousVideo: HTMLVideoElement }).previousVideo = node;
  });
  await viewer.getByRole("button", { name: "Следующее фото или видео", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { previousVideo: HTMLVideoElement }).previousVideo.paused)).toBe(true);
  await expect(viewer.getByText("Последний кадр публикации")).toBeVisible();
});

test("deleting a carousel sends one publication deletion and waits for confirmation", async ({ page }, info) => {
  const attachments: ApiPostMedia[] = [0, 1].map((position) => ({ id: `delete-${position}`, position,
    media_type: "PHOTO", media_url: pixel(), cloudinary_public_id: null, media_width: 1200, media_height: 800 }));
  const state = await mockMedia(page, { posts: [{ ...post("delete-me", "Удаляемая карусель"), attachments }] });
  let finish!: () => void;
  let requests = 0;
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => { nativeDialogs.push(dialog.message()); void dialog.dismiss(); });
  const done = new Promise<void>((resolve) => { finish = resolve; });
  await page.route("**/api-proxy/posts/delete-me", async (route) => {
    requests++;
    await done;
    state.posts = [];
    state.deleted.push("delete-me");
    await route.fulfill({ json: { ok: true, pendingMediaDeletions: 8 } });
  });
  await page.goto(`/?author=${authorId}&all=true`);
  await page.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Удалить публикацию?", exact: true });
  await expect(dialog.getByRole("button", { name: "Отмена", exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath("delete-dialog-desktop.png") });
  expect(requests).toBe(0);
  await dialog.getByRole("button", { name: "Удалить", exact: true }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(dialog.getByRole("button", { name: "Удаляем…", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Отмена", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Удаляемая карусель", exact: true, includeHidden: true })).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  finish();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Удаляемая карусель", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Публикация удалена" })).toBeVisible();
  expect(state.deleted).toEqual(["delete-me"]);
  expect(nativeDialogs).toEqual([]);
});

for (const mediaType of ["PHOTO", "VIDEO", "AUDIO", "STORY"] as const) {
  test(`deletion can be cancelled and confirmed for ${mediaType}`, async ({ page }, info) => {
    if (mediaType === "STORY") await page.setViewportSize({ width: 390, height: 844 });
    const target = { ...post("delete-one", "Удаляемая запись"), media_type: mediaType,
      ...(mediaType === "STORY" ? { media_url: "" } : {}) };
    const state = await mockMedia(page, { posts: [target] });
    await page.goto(`/?author=${authorId}&all=true`);
    const dialog = page.getByRole("dialog", { name: "Удалить публикацию?", exact: true });
    async function requestDeletion() {
      await page.getByRole("button", { name: "Действия с постом" }).click();
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
      await expect(dialog).toBeVisible();
    }
    await requestDeletion();
    if (mediaType === "STORY") await page.screenshot({ path: info.outputPath("delete-dialog-mobile.png") });
    if (mediaType === "STORY") await expect(dialog).not.toContainText("вложениями");
    else await expect(dialog).toContainText("всеми вложениями");
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.deleted).toEqual([]);
    await requestDeletion();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(state.deleted).toEqual([]);
    await requestDeletion();
    await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Публикация удалена" })).toBeVisible();
    expect(state.deleted).toEqual([target.id]);
  });
}

test("a failed deletion stays in the dialog and can be retried", async ({ page }) => {
  const state = await mockMedia(page, { posts: [post("retry-delete", "Запись для повтора")] });
  let attempts = 0;
  await page.route("**/api-proxy/posts/retry-delete", async (route) => {
    attempts++;
    if (attempts === 1) {
      await route.fulfill({ status: 503, json: { message: "Не удалось удалить публикацию. Попробуйте ещё раз." } });
      return;
    }
    state.posts = [];
    state.deleted.push("retry-delete");
    await route.fulfill({ json: { ok: true, pendingMediaDeletions: 0 } });
  });
  await page.goto(`/?author=${authorId}&all=true`);
  await page.getByRole("button", { name: "Действия с постом" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Удалить публикацию?", exact: true });
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Не удалось удалить публикацию");
  await expect(page.getByRole("heading", { name: "Запись для повтора", includeHidden: true })).toBeVisible();
  expect(state.deleted).toEqual([]);
  await dialog.getByRole("button", { name: "Повторить удаление", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Публикация удалена" })).toBeVisible();
  expect(attempts).toBe(2);
  expect(state.deleted).toEqual(["retry-delete"]);
  await page.getByRole("button", { name: "Скрыть уведомление" }).click();
  await expect(page.getByText("Публикация удалена", { exact: true })).toHaveCount(0);
});

test("a country URL with one city opens the country feed", async ({ page }) => {
  const state = await mockMedia(page);
  await page.goto(`/?author=${authorId}&country=Thailand`);
  await expect(page.getByRole("heading", { name: "Старая запись", exact: true })).toBeVisible();
  expect(new URLSearchParams(state.postQueries[0]).get("country")).toBe("Thailand");
});

test("a country with multiple cities shows new country posts and still filters by city", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await mockMedia(page, {
    cities: ["Bangkok", "Chiang Mai"],
    posts: [
      { ...post("bangkok", "Запись из Бангкока"), city: "Bangkok" },
      { ...post("chiang-mai", "Запись из Чиангмая"), city: "Chiang Mai" },
    ],
  });
  const dialog = await openComposer(page, "country=Thailand");
  await dialog.getByLabel("Выбрать фото и видео").setInputFiles([image("first.png"), image("second.png")]);
  await dialog.getByRole("textbox", { name: /Название/ }).fill("Публикация по стране");
  await dialog.getByRole("button", { name: "Опубликовать", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  expect(state.publications[0]).toMatchObject({ country: "Thailand", city: "" });
  const countryPost = page.getByRole("heading", { name: "Публикация по стране", exact: true });
  const bangkokPost = page.getByRole("heading", { name: "Запись из Бангкока", exact: true });
  const chiangMaiPost = page.getByRole("heading", { name: "Запись из Чиангмая", exact: true });
  await expect(countryPost).toBeVisible();
  await expect(bangkokPost).toBeVisible();
  await expect(chiangMaiPost).toBeVisible();

  await page.getByRole("button", { name: /город Bangkok/i }).click();
  await expect(page).toHaveURL(/city=Bangkok/);
  await expect(bangkokPost).toBeVisible();
  await expect(countryPost).toHaveCount(0);
  await expect(chiangMaiPost).toHaveCount(0);
});

test("all-journal media totals include posts without a location", () => {
  expect(selectFeedMediaStats({ places: { countries: [], totals: { posts: 1, photos: 2, videos: 1, stories: 0 } },
    all: true, selectedCountry: "", selectedCity: "" })).toEqual({ photos: 2, videos: 1 });
});
