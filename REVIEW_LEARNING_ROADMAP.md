# Travel: roadmap обучения по результатам senior-review

Этот файл — не замена основному `ROADMAP.md`.

Основной `ROADMAP.md` остается рабочим журналом: что сейчас делаем, какой flow
разбираем, какие маленькие изменения уже внесены.

Этот документ нужен для другого чата или будущей сессии: он фиксирует, что было
проверено при ревью проекта Travel, какие сильные стороны уже есть, какие явные
минусы найдены, почему они важны и в каком порядке их лучше улучшать с точки
зрения обучения.

## Короткий вердикт

Проект не нужно сжигать и писать сначала.

Это хороший учебный MVP: в нем уже есть backend, frontend, авторизация, роли,
загрузка медиа, интеграция с Cloudinary, база данных, навигация по местам,
лента, лайки, комментарии и немного e2e-проверок.

Главная ценность проекта сейчас не в идеальной архитектуре, а в том, что он уже
достаточно настоящий. На нем можно учиться инженерной работе: находить границы,
укреплять контракты, улучшать безопасность, добавлять тесты, не ломать
работающее и не переписывать ради красоты.

Как бы я оценил уровень:

- Для джуна: сильная работа, я бы принял с обязательным списком правок.
- Для мидла: не принял бы в production без доработок по контрактам, валидации,
  auth/security, тестам и миграциям.
- Для личного MVP: нормально, можно развивать постепенно.

## Что было проверено

Были просмотрены:

- структура проекта в корне;
- backend на Nest;
- frontend на Next;
- работа с PostgreSQL через `postgres`;
- самописные миграции;
- auth flow: register, login, me, JWT, roles, guards;
- posts flow: список, пагинация, создание, удаление;
- likes flow;
- comments flow;
- places flow;
- Cloudinary upload/import;
- frontend API layer;
- frontend auth state;
- feed orchestration;
- UI-компоненты ленты;
- package scripts;
- README и основной `ROADMAP.md`;
- базовые проверки lint/build/test.

Команды, которые запускались:

```bash
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test:e2e -- --list
cd backend && yarn lint
cd backend && yarn build
cd backend && yarn test
cd backend && yarn test:e2e
```

Результат проверок:

- `frontend npm run lint` прошел.
- `backend yarn lint` прошел, но важно: скрипт запускается с `--fix` и может
  менять файлы.
- `backend yarn build` прошел.
- `backend yarn test` прошел, но тест почти шаблонный.
- `backend yarn test:e2e` прошел после разрешения поднять локальный HTTP
  listener.
- `frontend npm run build` упал из-за недоступности `fonts.googleapis.com` для
  `next/font`, а не из-за TypeScript-ошибки.

## Что уже хорошо

### Backend

- Проект разложен по Nest-модулям: auth, users, posts, places, cloudinary, db.
- SQL-запросы написаны параметризованно, явной SQL-инъекции при просмотре не
  видно.
- Есть роли `USER`, `ADMIN`, `SUPERADMIN`.
- Есть guards для JWT и ролей.
- Есть cursor pagination для posts, а не примитивный offset pagination.
- Есть индексы для основных таблиц.
- Cloudinary import/upload уже решает реальную продуктовую задачу.

### Frontend

- Есть разделение на `app`, `features`, `entities`, `shared`.
- Используется TanStack Query, а не ручная мешанина из `useEffect + fetch`.
- Большой feed уже частично разнесен по хукам и компонентам.
- Есть понятные UI-компоненты для карточек, модалок, comments, places.
- Состояния загрузки и ошибок в основных местах хотя бы базово обработаны.

### Процесс

- В проекте уже есть `ROADMAP.md`, и он написан в правильном духе: маленькие
  шаги, понимание поведения перед изменениями, фокус на реальных проблемах.
- Это хороший способ учиться: не "переписать все на красивую архитектуру", а
  улучшать систему по одному flow.

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

### 8. Upload widget может использовать устаревший folder

Где смотреть:

- `frontend/src/features/upload/ui/cloudinary-upload-button.tsx`

Проблема:

Cloudinary widget создается один раз и сохраняется в `widgetRef`. При создании он
захватывает текущие `country/city/folder`. Если после этого поменять место в UI,
повторное открытие может использовать старую папку.

Чему учиться:

- stale closures;
- lifecycle внешних widgets;
- React state vs imperative third-party APIs.

Что улучшить:

- Пересоздавать widget при изменении `folder`.
- Или не кешировать widget, если создание достаточно дешевое.
- Или держать актуальный folder в ref и явно обновлять options, если Cloudinary
  widget это поддерживает.

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

### 10. Тесты есть, но доверия дают мало

Где смотреть:

- `backend/src/app.controller.spec.ts`
- `backend/test/app.e2e-spec.ts`
- `frontend/e2e/smoke.spec.ts`

Проблема:

Backend-тесты в основном проверяют шаблонный `Hello World`. Frontend smoke tests
проверяют, что страницы открываются, но почти не проверяют бизнес-поведение.

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
- Описать deploy targets: Render/Vercel/Cloudinary/DB.

## Рекомендуемый порядок обучения и улучшений

### Этап 1. Hygiene: сделать проект честно воспроизводимым

Цель:

Сделать так, чтобы другой разработчик мог поставить проект и понять, как его
запустить.

Что сделать:

- Добавить прямую зависимость `zod` или убрать его.
- Разделить `lint` и `lint:fix` на backend.
- Обновить README.
- Проверить `.env.example` для backend и frontend.
- Добавить корневые команды или хотя бы корневую инструкцию запуска.

Почему это первый этап:

Это маленькие изменения с большим эффектом. Они учат аккуратности и не требуют
глубокого refactor.

### Этап 2. Backend validation и DTO

Цель:

Перестать доверять входящему JSON.

Что сделать:

- Включить global `ValidationPipe`.
- Создать DTO для auth.
- Создать DTO для posts/comments.
- Унифицировать ошибки.
- Добавить tests на невалидный input.

Почему это важно:

Это базовый backend-навык. Без runtime validation TypeScript дает ложное чувство
безопасности.

### Этап 3. Tests на реальные flow

Цель:

Перед refactor получить страховку.

Что покрыть первым:

- register/login/me;
- role guard для admin endpoints;
- comments delete ownership и `postId + commentId`;
- posts list filters;
- cursor pagination;
- likes idempotency.

Почему tests до большого refactor:

Без тестов refactor превращается в "кажется, работает". С тестами можно учиться
менять архитектуру спокойно.

### Этап 4. Auth/security hardening

Цель:

Сделать auth не игрушечным.

Что сделать:

- Увеличить минимальную длину пароля.
- Добавить rate limit.
- Пересмотреть срок жизни access token.
- Обсудить localStorage vs httpOnly cookie.
- Добавить basic security notes в README.

Почему не обязательно первым:

Если проект личный и закрытый, можно сначала подтянуть contract/tests. Но перед
публичным использованием auth надо усилить.

### Этап 5. API contract и frontend API cleanup

Цель:

Сделать связь backend/frontend понятной и менее хрупкой.

Что сделать:

- Разнести `shared/api/api.ts` по доменам.
- Завести общий fetch wrapper.
- Синхронизировать response types с backend.
- Позже рассмотреть OpenAPI-generated client.

Почему это полезно:

Это учит границам между слоями и уменьшает вероятность незаметного расхождения
frontend/backend.

### Этап 6. Cloudinary split

Цель:

Разделить большой сервис на понятные ответственности.

Что сделать:

- Вынести pure helpers и покрыть их tests.
- Вынести Cloudinary API adapter.
- Вынести upload signing.
- Вынести import service.
- Оставить controller тонким.

Почему это хороший учебный refactor:

Там есть все: external API, DB, parsing, errors, long-running import. Отличный
материал для обучения service boundaries.

### Этап 7. DB migrations

Цель:

Перейти от "один большой idempotent script" к истории схемы.

Что сделать:

- Выбрать migration tool.
- Зафиксировать текущую схему как baseline.
- Новые изменения делать только через версии миграций.
- Добавить команду `migrate`.

Почему это позже:

Это важный, но более инфраструктурный слой. Лучше подойти к нему после того, как
основные flow и tests понятны.

### Этап 8. Frontend UX/accessibility polish

Цель:

Сделать UI не только красивым, но и устойчивым.

Что проверить:

- focus management в модалках;
- закрытие по Escape;
- scroll lock;
- loading/error states;
- mobile layout;
- stale folder в upload widget;
- alert/confirm заменить на нормальные dialogs.

Почему это отдельный этап:

UI-polish легко смешать с data/auth refactor. Лучше делать его отдельными
маленькими задачами.

## Как работать с этим roadmap

Правило:

Не брать сразу "улучшить архитектуру". Брать один маленький flow.

Хороший формат задачи:

```text
Разбери register/login flow.
Опиши текущее поведение.
Добавь DTO validation.
Добавь 2-3 теста на ошибки.
Не меняй auth strategy и UI.
```

Плохой формат задачи:

```text
Переделай auth нормально.
```

Почему:

В первом случае можно учиться конкретному навыку и проверить результат. Во
втором легко утонуть в большом refactor.

## Что можно попросить у другого чата

Примеры хороших prompts:

```text
Прочитай ROADMAP.md и REVIEW_LEARNING_ROADMAP.md.
Продолжим обучение по проекту Travel.
Возьми этап 1: dependency/config hygiene.
Сначала перечисли факты, потом предложи минимальные изменения, потом внеси их.
```

```text
Прочитай backend auth flow.
Нужно добавить DTO validation в Nest без большого refactor.
Сохрани текущее поведение, кроме более строгой validation.
Добавь tests.
```

```text
Разбери CloudinaryService.
Не переписывай сразу.
Сначала выдели ответственности и предложи первый безопасный extract.
```

```text
Проверь comments delete flow.
Нужно сделать контракт DELETE /posts/:id/comments/:commentId честным:
comment должен принадлежать post.
Добавь тест.
```

## Учебные принципы для этого проекта

- Сначала понять текущее поведение, потом менять.
- Не переписывать работающий код ради эстетики.
- Один flow — одна учебная задача.
- Любой refactor должен либо снижать риск, либо делать поведение понятнее.
- Перед большим refactor сначала добавить tests.
- Разделять факты, риски и вкусовщину.
- Не путать TypeScript-типы с runtime validation.
- Не доверять "работает на моей машине", если зависимость не описана явно.
- Документация — часть инженерной работы, а не украшение.

## Самый полезный следующий шаг

Я бы начал с этапа 1:

1. Исправить прямую зависимость `zod`.
2. Разделить backend scripts на `lint` и `lint:fix`.
3. Написать короткий корневой README: что это за проект, как запустить, какие env
   нужны, какие проверки запускать.

Это быстро даст ощущение контроля над проектом и подготовит почву для более
интересных тем: DTO validation, tests и auth.
