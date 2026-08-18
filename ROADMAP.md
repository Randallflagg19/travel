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

Следующий практический шаг: нормализовать backend contract для places/posts.

Статус: реализовано локально, нужно проверить поведение на данных и затем решить,
готово ли к commit/push/deploy.

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

Что уже изменено локально:

- `backend/src/places/places.service.ts` больше не возвращает `unknown`.
- `/places` игнорирует rows без `country`, но включает `country` без `city` как country-level destination.
- `backend/src/posts/posts.service.ts` поддерживает `/posts?country=...` без `city` как country-level filter.
- Frontend `PlacesResponse` больше не ожидает `unknown`.
- Frontend navigation больше не генерирует `unknown=true`.
- `Indonesia / Bali` больше не hardcoded как "Bali root"; это обычный `country + city`.
- Country-only upload пока не включен: upload metadata по-прежнему ставится только при `country + city`, чтобы случайно не создать `Thailand` без города.

Ожидаемый контракт:

- `/places` возвращает навигационный индекс стран и городов на основе данных posts.
- `cities.length === 0` означает country-level destination.
- `cities.length === 1` означает direct city feed без отдельного экрана выбора.
- `cities.length > 1` означает city selection screen.
- `/posts?country=Thailand` без `city` не используется как финальная лента: frontend показывает выбор города.
- `/posts?country=Thailand&city=Bangkok` и `/posts?country=Thailand&city=Pattaya` возвращают конкретные city-level ленты.
- Посты без `country` могут отображаться в `all`, но `unknown` не нужен как нормальный раздел навигации.

Перед реализацией нужно сформулировать минимальное backend-изменение и проверить,
не ломает ли оно текущие сценарии Indonesia/Bali, Thailand и all.

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
- Delete confirmation modal для комментария визуально ведет себя странно при скролле/смещении карточки.
- Нужно отдельно проверить, относится ли INP issue к places navigation, feed card actions, comment modal или toolbar/dev overlay.

Почему не делаем сейчас:

- Это frontend/UI задача, а текущий практический фокус — backend contract для places/posts.
- Не хотим смешивать data model change, UI polishing и performance investigation в один refactor.

Что сделать позже:

- Воспроизвести INP issue локально без лишних overlays, если возможно.
- Проверить click handlers в places/sidebar/feed card/comment modal.
- Разобрать ownership delete confirmation modal.
- После диагностики предложить маленькое UI/performance изменение.

## Недавний cleanup

- Убран deprecated `baseUrl` из `backend/tsconfig.json`.
- Backend build после этого проходит.
