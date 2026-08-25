# Roadmap изучения проекта Travel

Это учебный roadmap и рабочий журнал решений. Он не является планом большого
рефакторинга.

Главная идея: сначала восстановить реальное поведение проекта, затем выбрать
маленькое изменение, которое решает настоящую проблему сопровождения или модели
данных.

## Как мы работаем

- Разбираем один flow или один контракт за раз.
- Сначала описываем текущее поведение простыми словами.
- Отделяем факты о системе от желаемого дизайна.
- Не переписываем код ради архитектурной красоты.
- Предпочитаем маленькие изменения с понятным поведением.
- После изменения проверяем, что именно изменилось и какие trade-offs появились.

## Текущий фокус

Последний практический шаг: нормализовать backend contract для places/posts.

Статус: реализовано, проверено локально, закоммичено, запушено и выложено через
Render/Vercel.

Почему backend первым:

- Frontend должен строить навигацию из честного API contract, а не из набора
  специальных исключений.
- Нужно решить, какие места являются конечной лентой, а какие требуют выбора
  города.
- Посты без `country` могут оставаться только в `all`, но не должны становиться
  нормальным пунктом навигации.
- Frontend не должен костылить поверх API, который не выражает нужную модель.

Что нужно разобрать перед кодом:

1. `backend/src/places/places.service.ts`
2. `backend/src/posts/posts.service.ts`

Что изменили:

- `backend/src/places/places.service.ts` больше не возвращает `unknown`.
- `/places` игнорирует rows без `country`, но включает `country` без `city` как country-level destination.
- `backend/src/posts/posts.service.ts` поддерживает `/posts?country=...` без `city` как country-level filter.
- Frontend `PlacesResponse` больше не ожидает `unknown`.
- Frontend navigation больше не генерирует `unknown=true`.
- `Indonesia / Bali` больше не hardcoded как "Bali root"; это обычный `country + city`.
- Country-only upload пока не включен: upload metadata по-прежнему ставится только при `country + city`, чтобы случайно не создать `Thailand` без города.

Что полезного получилось:

- Backend contract стал проще: `/places` возвращает только `countries`.
- `unknownCount`, ветка `unknown` и UI-раздел `unknown` перестали быть частью нормальной модели навигации.
- `PlacesService` стал короче и читается как один понятный проход по rows: собрать страны, добавить города, отсортировать, вернуть результат.
- Country-only destinations теперь выражаются явно: страна есть, городов нет.
- Frontend больше не угадывает специальный смысл `unknown`, а строит UI из структуры `countries/cities`.
- `Indonesia / Bali` больше не special case: это обычный city-level раздел, как и должно следовать из данных.
- Важно: заметное ускорение первой загрузки постов, скорее всего, появилось не только из-за этого cleanup. Основной вклад, судя по истории, дал более ранний commit `4d3be6b` (`Speed up initial posts feed loading`), где сильно упростилась backend-выборка постов.
- Текущий этап усилил этот результат: стало меньше frontend-состояний, меньше лишних веток выбора места и понятнее момент, когда posts query вообще должен запускаться.

Ожидаемый контракт:

- `/places` возвращает навигационный индекс стран и городов на основе данных posts.
- `cities.length === 0` означает country-level destination.
- `cities.length === 1` означает direct city feed без отдельного экрана выбора.
- `cities.length > 1` означает city selection screen.
- `/posts?country=Thailand` без `city` не используется как финальная лента: frontend показывает выбор города.
- `/posts?country=Thailand&city=Bangkok` и `/posts?country=Thailand&city=Pattaya` возвращают конкретные city-level ленты.
- Посты без `country` могут отображаться в `all`, но `unknown` не нужен как нормальный раздел навигации.

Проверено на live:

- `Indonesia / Bali` отображается без отдельного hardcode "Bali root".
- `China / Beijing` открывается как direct city feed.
- `Egypt` открывается как country-level feed.
- `Thailand` показывает выбор `Bangkok / Pattaya`, а не смешанную ленту всей страны.
- `all` остается местом, где могут отображаться посты без нормального места.

Практический шаг завершен: delete confirmation modal для комментариев.

Что сделали:

- Понять текущий comments/delete flow.
- Найти, почему delete confirmation modal на desktop иногда позиционируется как часть карточки/поста, а не как стабильное окно поверх страницы.
- Сделать маленькое изменение, после которого confirmation modal для удаления комментария стабильно показывается по центру viewport на desktop и mobile.
- Не переписывать весь comments flow и не начинать большой refactor `FeedPostCard`.
- Проверили экспериментально, что удаление `fixed` превращает modal в обычный layout-блок внутри карточки и не является правильным решением.
- Оставили `fixed`, но вынесли DOM overlay через `createPortal(..., document.body)`.
- State удаления (`deleteConfirmCommentId`) остался рядом с comments logic, а визуальный overlay больше не зависит от `overflow-hidden`, hover transform и stacking context карточки.
- С карточек постов убрали отображение даты создания, потому что она не нужна в текущем UI.

Что оставили на потом:

- Закрытие confirm modal по `Escape`.
- Более аккуратный focus management для dialog.
- Блокировка background scroll, если она понадобится.
- Проверка поведения, когда пользователь печатает комментарий и случайно нажимает `Escape`.

Следующий практический шаг выбран: сделать `Feed` более понятным orchestrator-компонентом.

Цель этапа:

- Улучшить читаемость без изменения поведения.
- Не начинать большой rewrite feed.
- Разделить UI-части и orchestration маленькими шагами, чтобы каждый шаг можно было проверить.
- Не гнаться за числом строк само по себе: файл может быть 300+ строк, если границы ответственности читаются.

Что уже вынесли из `Feed`:

- `FeedHero` в отдельный UI-компонент.
- `MobileChapters` в отдельный UI-компонент.
- `MobileChapter`, `buildMobileChapters` и label helpers в `features/feed/model`.
- `CitySelection` в отдельный UI-компонент.
- `FeedEmptyState` удален как мертвый компонент, который всегда возвращал `null`.

Что стало заметно после UI-extract:

- JSX в `Feed` уже не главная проблема.
- Основная сложность теперь в orchestration: URL params, places query, posts query, derived selection state, infinite scroll, expanded modal, delete post, optimistic like update, comments open state.
- Большие тернарники в posts rendering ухудшают читаемость, но это не первая архитектурная боль.

Следующий порядок для ручного refactor:

1. Дать явное имя константе `limit`: например `POSTS_PAGE_LIMIT`.
2. Разобрать derived selection state рядом одним блоком: `selectedCountryPlace`, `hasCountryOnlySelection`, `isCitySelection`, `isCountryFeed`, `canLoadPosts`.
3. Вынести расчет параметров posts query в маленькую функцию/model helper, чтобы убрать вложенный ternary из `queryFn`.
4. Только потом думать о hook extraction для posts query или feed selection state.
5. Не выносить `updatePostLike` до тех пор, пока не решим границу optimistic updates и `postsQueryKey`.

Следующие UI-only кандидаты после `Feed`:

- `PostCommentsBlock`: вынести список комментариев в `CommentsList`, не меняя query/mutation logic.
- `PostCommentsBlock`: вынести форму отправки в `CommentForm`, оставив submit handler во внешнем блоке.
- `FeedPostCard`: вынести media preview в `PostMediaPreview`.
- `FeedPostCard`: вынести overlay/actions часть в маленькие компоненты, но пока не трогать like mutation orchestration.

Правило этапа:

- Сначала дробим JSX и визуальные куски.
- Mutation orchestration лайков и comments cache пока не переносим.
- Если пропсов становится больше, чем было, останавливаемся и обсуждаем границу компонента.
- После каждого шага запускать `cd frontend && npx tsc --noEmit` и `cd frontend && npm run lint`, плюс smoke-test `Thailand -> Bangkok/Pattaya`.

Кандидаты на потом:

- Учебно разобрать `FeedPostCard`, где сейчас смешаны UI и mutation orchestration.
- Разобрать upload flow, потому что права admin и country/city metadata влияют на будущую модель данных.

## Уже разобрано

### Like flow

Цепочка:

`user click -> FeedPostCard -> callback в Feed -> TanStack Query cache -> API layer -> backend -> invalidation/refetch -> UI`

Что зафиксировали:

- `FeedPostCard` обрабатывает click по лайку.
- `FeedPostCard` проверяет `likePending`, `canLike`, `accessToken`.
- Если пользователь не может лайкать или нет token, происходит переход на `/login`.
- `nextLiked` означает желаемое состояние после клика.
- `delta` меняет счетчик лайков на `+1` или `-1`.
- Optimistic update начинается в `handleLikeClick`, но cache реально меняется в `Feed`.
- `Feed` знает `postsQueryKey` и делает `queryClient.setQueryData(...)`.
- `FeedPostCard` вызывает `likePost` / `unlikePost`.
- После success parent инвалидирует `["posts"]`, чтобы получить backend truth.
- После error происходит rollback через `onLikeToggled(previous)`.

Открытый архитектурный вопрос:

- Нас устраивает, что `FeedPostCard` одновременно UI-компонент и место, где живет mutation orchestration?

Пока не исправляем. Это хорошая тема для отдельного маленького refactor-review после backend contract.

### Feed selection и URL-state

Предметная модель:

- `/?all=true` — валидное состояние "показать все".
- `city` без `country` — невалидное состояние.
- `country=Thailand` без `city` — валидное промежуточное состояние выбора города.
- `country=Thailand&city=Bangkok` и `country=Thailand&city=Pattaya` — валидные конечные ленты.
- `country=Indonesia&city=Bali` — обычный city-level state. Специальный hardcode "Bali как корень" не нужен.
- Egypt и China пока обсуждаются как возможные country-level или direct-city destinations в зависимости от реальных данных.
- `unknown` не нужен как нормальный раздел UI.

Черновая модель:

```ts
type FeedSelection =
  | { kind: "all" }
  | { kind: "invalid"; reason: string }
  | { kind: "country-needs-city"; country: string }
  | { kind: "country"; country: string }
  | { kind: "city"; country: string; city: string };
```

Желаемая граница:

`URLSearchParams -> parseFeedSelection -> FeedSelection -> Feed`

Но это frontend-шаг после backend contract.

## Backlog учебных тем

### Upload flow

Цепочка:

`Upload button -> auth/session -> current URL context -> Cloudinary config/signature -> widget success -> createPost -> backend`

Файлы:

- `frontend/src/features/upload/ui/cloudinary-upload-button.tsx`
- `frontend/src/shared/api/api.ts`
- `backend/src/cloudinary/cloudinary.controller.ts`
- `backend/src/posts/posts.controller.ts`

Вопросы:

- Кто имеет право upload?
- Какая папка используется для media?
- Какие `country` / `city` metadata прикрепляются к post?
- Что происходит, если пользователь поменял место после создания widget?
- Upload обновляет или инвалидирует feed/places cache после создания post?
- Как upload должен вести себя в состоянии `country-needs-city`?
- Как upload должен поддерживать country-level destinations без риска создать post в стране, где нужно выбрать город?

### Comments flow

Цепочка:

`open comments -> fetch comments -> add/delete comment -> comments cache update -> posts invalidation for comment_count -> UI`

Файлы:

- `frontend/src/features/feed/ui/post-comments-block.tsx`
- `frontend/src/features/feed/ui/feed-post-card.tsx`
- `frontend/src/features/feed/ui/feed.tsx`
- `frontend/src/shared/api/api.ts`
- `backend/src/posts/interactions.controller.ts`

Вопросы:

- Где comments state?
- Что здесь local UI state?
- Что здесь server state?
- Почему comments cache обновляется напрямую, а posts cache инвалидируется?
- Хорошее ли имя `onCommentAdded`, если оно вызывается и после delete?
- На правильном ли UI-уровне живет delete confirmation modal?

### Границы компонента Feed

Файлы:

- `frontend/src/features/feed/ui/feed.tsx`
- `frontend/src/features/feed/ui/feed-post-card.tsx`
- `frontend/src/features/feed/ui/feed-expanded-modal.tsx`
- `frontend/src/features/feed/model/use-expanded-modal-behavior.ts`

Вопросы:

- Какие ответственности сейчас держит `Feed`?
- Какие ответственности должны оставаться рядом?
- Какие ответственности случайно оказались в одном файле?
- Извлечение чего-то уменьшит реальную сложность или просто создаст больше файлов?
- Какое поведение нужно сохранить, если мы что-то меняем?

### UI/performance и визуальные дефекты

Статус: зафиксировано, но не текущий фокус.

Наблюдения:

- Vercel Toolbar показал INP issue: event handlers заблокировали UI примерно на `421ms`.
- Delete confirmation modal для комментария визуально вел себя странно при скролле/смещении карточки; исправлено через portal, но accessibility-доработки оставлены на потом.
- Нужно отдельно проверить, относится ли INP issue к places navigation, feed card actions, comment modal или toolbar/dev overlay.
- На мобильной версии и при холодной первой загрузке долго видны skeleton-заглушки стран/разделов.
- В Network видно, что `/places` после прогрева может отвечать быстро (`~148ms`), но холодный запрос наблюдался заметно дольше (`~1.2s`).
- Первичная загрузка постов всё ещё может ощущаться долгой, даже если повторные запросы после cache/warm-up быстрые.
- В UI не всегда достаточно ясно показано, что именно сейчас грузится: places navigation или первая страница posts.

Почему не делаем сейчас:

- Это frontend/UI задача, а текущий практический фокус — backend contract для places/posts.
- Не хотим смешивать data model change, UI polishing и performance investigation в один refactor.

Что сделать позже:

- Воспроизвести INP issue локально без лишних overlays, если возможно.
- Отдельно измерить cold load и warm load для `/places` и первой страницы `/posts`.
- В DevTools Network смотреть `Timing`: TTFB, content download, initiator, cache status.
- Проверить, есть ли на Render cold start или задержка database connection для первых запросов.
- Решить, нужен ли отдельный `PERFORMANCE_NOTES.md`, если измерений станет больше одного-двух наблюдений.
- Проверить click handlers в places/sidebar/feed card/comment modal.
- Разобрать ownership delete confirmation modal.
- После диагностики предложить маленькое UI/performance изменение.

## Недавний cleanup

- Убран deprecated `baseUrl` из `backend/tsconfig.json`.
- Backend build после этого проходит.
