# Рефакторинг и учебный инженерный backlog

Сверено с кодом 2026-09-07. Второй этап [общего плана](ROADMAP.md), после
[UI и мобильных взаимодействий](FIRST_SCREEN_ROADMAP.md).
Здесь единственное место для архитектурных задач, контрактов данных и тестов.

## Выполнено по коду

- Backend `lint` уже не меняет файлы; отдельный `lint:fix` содержит `--fix`.
- Feed разделён на `FeedHero`, `MobileChapters`, `CitySelection`, selection/query
  helpers, expanded-modal и comments hooks. `PostMediaPreview` и
  `usePostLikeToggle` вынесены из карточки; `Feed` остаётся orchestrator.
- Upload signing использует timestamp виджета; после `createPost` инвалидируются
  `posts` и `places`. Busy сбрасывается по событиям виджета, а widget пересоздаётся
  при смене folder. Это не будущие fixes.
- `/places` поддерживает country-level навигацию; БД является источником данных.

Исторические ориентиры коммитов: `4856fa0` (signature), `175f45f` (invalidation),
`a72ab0f`, `0a8508a`, `ff2bca5` (feed/card extracts), `026ec8f` (places contract).
Наличие реализации сверено в рабочем дереве, свежий runtime smoke не выполнялся.

## Запланировано: ограниченный этап перед переносом frontend

1. **Воспроизводимость.** Исправить прямую зависимость `zod` или убрать её
   использование, актуализировать README/env examples и инструкции запуска.
   `frontend/.env.local.example` всё ещё указывает Render;
   `backend/.env.example` содержит старую Render-подсказку для JWT.
   Разделение lint уже завершено. Выбрать и документировать package manager:
   frontend имеет package-lock, backend — yarn.lock; исторически на VPS применялся npm.
2. **Upload без изменения поведения.** Вынести feature-local типы в
   `frontend/src/features/upload/model/cloudinary-upload-types.ts`, helpers в
   `cloudinary-upload.ts`: `pickMediaType`, `buildUploadFolder`, parser/guard
   для неизвестного результата. Сейчас этих model-файлов нет, логика в UI.
   Проверить image → PHOTO, video/mov → VIDEO, video/mp3 → AUDIO,
   country/city и fallback folder, success/несuccess и некорректный payload.
   В frontend пока нет unit-test script: выбрать минимальный способ запуска
   полезных helper tests, не тестировать настоящий Cloudinary widget unit-тестом.
3. **Lifecycle upload.** Только после helper extract решить, полезен ли
   `useCloudinaryUpload` для busy/refs/create/open. Проверить открытие виджета,
   фото/видео, смену раздела и обновление feed/places без refresh.
4. **API и границы.** После upload выделить общий transport/error handling и
   доменные requests из `shared/api/api.ts`; описать допустимые imports.
   Feed импортирует labels из places: переносить их в entities/shared только
   при понятной общей ответственности. Не дробить компоненты ради числа строк.

Готово: выбранный объём этих шагов завершён, проверки проходят, upload и
навигация сохраняют поведение. Оставшиеся крупные backend-темы ниже — отдельный
backlog; не требуется закончить их все до [frontend VPS](VPS_FRONTEND_MIGRATION_ROADMAP.md).

## Контракты и решения, которые сохраняем при рефакторинге

- Upload: frontend → backend config/signature → Cloudinary widget → createPost
  → БД → TanStack invalidation. Географию задаёт запись БД, не папка Cloudinary.
- Ручной move/delete в Cloudinary не синхронизирует БД. Delete через приложение:
  Cloudinary destroy best-effort → DELETE posts → invalidation posts/places.
- Metadata/EXIF может изменить `created_at`, поэтому видео после upload бывает
  ниже новых записей. Сортировка ближе к дате кадра; менять только при UX-причине.
- `cities.length === 0`: country-level; `=== 1`: прямой переход в город;
  `> 1`: выбор города. Posts без country видны в all, но не создают раздел.
- Country-only upload сейчас попадает в `${root}/all` и не передаёт country/city.
  Нормализация `Tapir`/`tapir` и явный cloudinaryRoot вместо username требуют
  отдельного решения; не менять контракт скрыто внутри extract.
- Move post location не входит в текущий этап: редкие ошибки можно исправлять
  удалением/перезаливкой или отдельной ручной корректировкой данных.

## Главные минусы и чему на них учиться

### 1. Нет строгого API-контракта между backend и frontend

Где смотреть:

- `frontend/src/shared/api/api.ts`
- backend controllers и services

Проблема:

Frontend вручную описывает типы ответов backend. Backend при этом не экспортирует
единый контракт, а входные данные часто типизированы только TypeScript-типами в
`@Body()`. TypeScript не валидирует JSON в runtime.

Почему это важно:

Если backend поменяет поле, frontend может узнать об этом только во время
поломки. Если пользователь отправит неожиданный JSON, TypeScript backend не
спасет.

Чему учиться:

- DTO;
- runtime validation;
- единый формат ошибок;
- OpenAPI/Swagger или shared schemas;
- разница между compile-time type safety и runtime validation.

Что улучшить:

- Включить глобальный `ValidationPipe` в Nest.
- Завести DTO для register/login/createPost/addComment.
- Для query params тоже сделать явную валидацию.
- Позже подумать про OpenAPI-generated client или shared schemas.

### 2. Случайная зависимость `zod`

Где смотреть:

- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/package.json`

Проблема:

`zod` используется во frontend-коде, но не объявлен в dependencies. Сейчас он
лежит в `node_modules` транзитивно через другие пакеты. Это значит: на чистой
установке или после обновления зависимостей проект может сломаться.

Чему учиться:

- dependency hygiene;
- разница между direct dependency и transitive dependency;
- почему "работает локально" не равно "проект корректно описан".

Что улучшить:

- Добавить `zod` в `frontend/package.json`, если он нужен.
- Или убрать `zod` и сделать простую ручную validation, если не хочется
  зависимости.

### 3. Auth сделан как MVP, не как production auth

Где смотреть:

- `frontend/src/entities/session/model/token.ts`
- `frontend/src/entities/session/model/auth.tsx`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.controller.ts`

Проблемы:

- JWT хранится в `localStorage`.
- Нет refresh-token/session strategy.
- Access token живет `30d`.
- Минимальная длина пароля — 3 символа.
- Нет rate limiting на login/register.

Почему это важно:

`localStorage` удобен, но уязвим при XSS. Долгоживущий access token повышает
цену утечки. Слабый пароль и отсутствие rate limit делают auth слишком мягким.

Чему учиться:

- threat modeling;
- XSS и хранение токенов;
- httpOnly cookies;
- refresh tokens;
- password policy;
- rate limiting;
- security trade-offs для MVP.

Что улучшить:

- Поднять минимальную длину пароля хотя бы до 8.
- Добавить rate limit на auth endpoints.
- Сократить время жизни access token.
- Позже перейти на httpOnly cookie/session model или refresh token flow.

### 4. CloudinaryService слишком большой

Где смотреть:

- `backend/src/cloudinary/cloudinary.service.ts`

Проблема:

Один сервис делает слишком много:

- читает config;
- подписывает upload;
- работает с Cloudinary API;
- импортирует папки;
- обходит folder tree;
- парсит EXIF/GPS/date metadata;
- пишет posts в БД;
- строит Cloudinary URL;
- собирает ошибки импорта.

Почему это важно:

Большой сервис сложно тестировать, сложно менять и сложно читать. Любое изменение
Cloudinary import может случайно задеть upload signing или metadata parsing.

Чему учиться:

- single responsibility;
- application service vs infrastructure client;
- pure functions для парсинга;
- тестирование внешних интеграций через mocks/fakes.

Что улучшить:

- Вынести `CloudinaryClient` или adapter для API Cloudinary.
- Вынести `CloudinaryUploadSigningService`.
- Вынести `MediaMetadataService` для EXIF/date/GPS parsing.
- Вынести `CloudinaryImportService`.
- Pure helpers покрыть unit-тестами.

### 5. Миграции самописные и без версий

Где смотреть:

- `backend/src/db/migrations.ts`
- `backend/src/db/db-migrations.service.ts`

Проблема:

Миграции выполняются как один большой idempotent-скрипт. Для MVP это удобно, но
дальше становится трудно понимать историю схемы, откаты, порядок изменений и
состояние разных окружений.

Чему учиться:

- database migration history;
- schema versioning;
- rollback strategy;
- repeatable migrations vs versioned migrations.

Что улучшить:

- Выбрать migration tool: Drizzle, Prisma migrations, Kysely migrations или
  отдельный SQL migration runner.
- Разбить схему на версионированные миграции.
- Добавить команду для запуска миграций отдельно от старта приложения.

### 6. SQL в PostsService сложный и дублируется

Где смотреть:

- `backend/src/posts/posts.service.ts`

Проблема:

`listPage` содержит две большие ветки SQL для `asc` и `desc`. Они почти
одинаковые, но отличаются операторами сравнения и order direction.

Почему это важно:

Когда логика фильтрации изменится, легко исправить одну ветку и забыть вторую.

Чему учиться:

- duplication risk;
- query builder vs raw SQL;
- как рефакторить SQL без потери читаемости;
- как писать tests на pagination.

Что улучшить:

- Сначала покрыть поведение тестами.
- Потом аккуратно убрать дублирование или явно вынести общие части.
- Не усложнять динамическим SQL, если получится оставить запрос читаемым.

### 7. Comments delete flow неполный по контракту

Где смотреть:

- `backend/src/posts/interactions.controller.ts`
- `backend/src/posts/comments.service.ts`

Проблема:

Endpoint выглядит как:

```http
DELETE /posts/:id/comments/:commentId
```

Но service удаляет комментарий только по `commentId` и проверяет owner. Он не
проверяет, что комментарий действительно принадлежит `postId` из URL.

Почему это важно:

Сейчас это не выглядит как критическая security-дыра, потому что owner все равно
проверяется. Но API-контракт нечестный: URL говорит, что удаление происходит
внутри конкретного поста, а backend это не подтверждает.

Чему учиться:

- API contract consistency;
- authorization vs resource ownership;
- почему route params должны участвовать в проверке.

Что улучшить:

- Передавать `postId` в `comments.delete`.
- Искать комментарий по `id + post_id`.
- Вернуть `404`, если такой пары нет.
- Добавить тест.

### 8. Upload widget: прежний stale folder исправлен по коду

`widgetFolderRef` сравнивается с вычисленным folder; widget пересоздаётся при
изменении папки. Повторять этот fix не нужно. Остались проверки lifecycle:
переход между разделами, смена пользователя/token, country-only upload и ошибки.
Учебная тема прежняя: stale closures и границы imperative API / React state.

### 9. Frontend API layer слишком большой

Где смотреть:

- `frontend/src/shared/api/api.ts`

Проблема:

В одном файле лежат типы и функции для posts, places, auth, Cloudinary,
comments, likes.

Почему это важно:

Сейчас файл еще терпимый, но он станет "общим ящиком", куда будут складываться
все новые endpoints.

Чему учиться:

- module boundaries;
- domain-based API clients;
- shared http client;
- как не делать преждевременную абстракцию.

Что улучшить:

- Создать общий `apiClient` для base URL, headers, error parsing.
- Разнести функции по файлам: `auth-api`, `posts-api`, `places-api`,
  `cloudinary-api`, `comments-api`.
- Типы держать рядом с доменом или генерировать из backend-контракта.

### 10. Тесты есть, но покрытие ограничено

Где смотреть:

- `backend/src/app.controller.spec.ts`
- `backend/test/app.e2e-spec.ts`
- `frontend/e2e/smoke.spec.ts`

Проблема:

Backend-тесты в основном проверяют шаблонный `Hello World`. Frontend smoke tests
проверяют страницы и all-feed; тест сохранения лайка зависит от E2E credentials
и может пропустить проверку, если кнопка не найдена. Это не надёжная регрессия flow.

Чему учиться:

- testing pyramid;
- unit vs integration vs e2e;
- tests as contracts;
- какие тесты дают уверенность, а какие просто существуют.

Что улучшить:

- Backend unit/integration tests на auth, roles, comments, likes, posts filters.
- Tests на cursor pagination.
- Tests на DTO validation.
- Frontend e2e на login, filtering, comments, upload happy path через mock.
- Не пытаться покрыть всё сразу. Начать с одного flow.

### 11. README остались шаблонными

Где смотреть:

- `backend/README.md`
- `frontend/README.md`

Проблема:

README почти от Nest/Next starter. Они не объясняют, что такое Travel, какие env
нужны, как запускать backend + frontend вместе, как прогонять проверки и какие
есть основные flow.

Чему учиться:

- project onboarding;
- documentation as engineering tool;
- как писать README для будущего себя.

Что улучшить:

- Написать корневой README.
- Описать architecture overview.
- Описать env vars.
- Описать local setup.
- Описать common commands.
- Описать deploy targets: VPS backend / Vercel frontend (до переноса) / Cloudinary / Neon.

## Остальной backlog: последовательность по зависимостям

- Runtime DTO/query validation и единые ошибки, затем tests невалидного input.
- Tests auth/roles, ownership и пары postId + commentId, фильтров, обоих
  направлений cursor pagination и idempotency likes перед изменением этих flow.
- Auth hardening отдельной задачей, с явным решением о паролях, rate limit,
  сроках JWT и хранении сессии; не смешивать с переносом frontend.
- Backend Cloudinary split после тестов helpers: adapter, signing, metadata,
  import; SQL cleanup после pagination tests; versioned migrations с baseline
  и отдельной командой. База остаётся на Neon.
- `useFeedPosts`, `PostCardActions`/`PostCardMeta`, `CommentsList`/`CommentForm`
  — только при снижении сложности. Уточнить имя `onCommentAdded`, если callback
  вызывается после удаления. UI/accessibility задачи ведутся в UI-roadmap.

## Требует проверки

- Чистая установка и текущие lint/build/test. Старый review сообщал об успешных
  lint/backend tests и сбое frontend build при загрузке Google Fonts;
  это история, а не результаты этой сверки. `layout.tsx` всё ещё использует
  `next/font/google`, доступность шрифтов при будущей сборке нужно проверить.
- Backend test suite в основном проверяет Hello World. E2E создаёт приложение
  без bootstrap из main.ts, поэтому не доказывает production prefix/CORS.
- README и env examples требуют сверки с реальным local setup, без секретов.

После соответствующих изменений: frontend `npx tsc --noEmit`, `npm run lint`,
`npm run build`, целевые tests; backend `yarn lint`, `yarn build`, `yarn test`,
`yarn test:e2e` в тестовом окружении. Не запускать мутирующие e2e на production.

Один flow — одна задача: описать поведение, сделать небольшой шаг, проверить.
Рефакторинг должен улучшать понятность или снижать риск. TypeScript-типы не
заменяют runtime validation; новые файлы сами по себе не означают улучшение.
