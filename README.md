# Travel

Журнал путешествий: фото/видео в Cloudinary, истории, места, закрепление, лайки и
комментарии. Доверенные участники с ADMIN публикуют медиа в своих журналах;
AUTHOR пока может публиковать только текстовые истории.

- [Что делать дальше](ROADMAP.md)
- [Посты с несколькими медиа](docs/MEDIA_POSTS.md)
- [Устройство, проверки и запуск карусели](docs/MEDIA_POSTS_SETUP.md)
- [Технические задачи и актуальные статусы](docs/BACKLOG.md)
- [Аудит кода и загрузки](docs/AUDIT_2026-10-21.md)
- [Эксплуатация](docs/OPERATIONS.md)
- [Что убрать](docs/CLEANUP.md)
- [Архив](docs/archive/2026-10-21/README.md)

`frontend`: Next.js App Router, React, TanStack Query; клиентская лента.
`backend`: NestJS, PostgreSQL/postgres.js, JWT/Argon2, Cloudinary.
`infra` и `.github/workflows`: шаблоны и ручной release deploy.
После миграции PostgreSQL находится на новом VPS; комментарии о Neon устарели.

## Проверки

Frontend — npm/package-lock, backend — Yarn Classic/yarn.lock. CI использует Node 24.
Из соответствующей директории:

```sh
# frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build

# backend
yarn install --frozen-lockfile
yarn lint
yarn test --runInBand
yarn build
```

Frontend build требует NEXT_PUBLIC_API_URL и доступа к Google Fonts.
NEXT_PUBLIC_SITE_URL задаёт домен OG. Эти значения фиксируются при сборке.
Для тестов с моками собрать с NEXT_PUBLIC_API_URL=/api-proxy, запустить локально на
3000, затем выполнить
`npx playwright test e2e/media-posts.spec.ts e2e/feed-responsive.spec.ts e2e/feed-selection.spec.ts`.

Общий smoke.spec.ts включает настоящий login/лайк; не запускать его на production
ради проверки документации. Backend e2e читает окружение через AppModule: нужна
проверенная изолированная тестовая конфигурация.

Env examples требуют исправления: frontend proxy направлен в production;
backend упоминает Render/Neon и включает миграции на старте. Для локальной разработки
заменить API/DB на тестовые. Не создавать backend/package-lock.json рядом с yarn.lock.

## Миграции базы

В `backend` есть отдельная команда `npm run db:migrate` (или `yarn db:migrate`).
Она запускает собранный `dist/db/migrate.js`: локально сначала выполнить
`yarn build`, а в готовом серверном архиве сборка уже есть. Для запуска миграций
исходники и `ts-node` не требуются.

Команда требует явно переданный через окружение `DATABASE_URL` и не читает `.env`.
Для выпуска с изменениями схемы отдельно согласовываем целевую БД, проверяем
восстановление свежей копии и применяем миграции из новой сборки до переключения
backend. У службы приложения `DB_MIGRATE_ON_START=false`.

На staging версии `001_legacy` и `002_media_posts` применены вручную с правами
администратора PostgreSQL. Приложению выданы права на новые таблицы. Бэкенд
выпущен с выключенным `run_migrations`, затем выпущен фронтенд. На staging
владелец проверил публикацию по стране и городу и удаление файлов из Cloudinary.
Выпуск карусели на production требует отдельной подготовки. Подробности —
в [инструкции карусели](docs/MEDIA_POSTS_SETUP.md).
