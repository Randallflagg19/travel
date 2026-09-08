# План переноса frontend с Vercel на VPS

Обновлено 2026-09-08. **Запланировано, не выполнено.** Третий этап
[общего плана](ROADMAP.md): после UI/мобильных взаимодействий и ограниченного
этапа рефакторинга. Backend уже на VPS, Neon и Cloudinary оставляем.

Основание — [инцидент собственного домена Vercel](VERCEL_CUSTOM_DOMAIN_INCIDENT.md).
Перенос обходит проблемный путь доставки; первопричина неизвестна, результат
на сетях пользователя ещё предстоит проверить.

## Передача в следующий чат — 2026-09-08

Пользователь выбрал деплой текущей реализации следующим шагом; завершение всего
UI/refactor backlog не является предварительным условием этого шага. Сам деплой
в этом чате не выполнялся. Основной проект: `/Users/tapir/Programming/travel`.
Использовать его актуальную ветку и commit; факт push заново проверить.

Видеомодалка: крестик, остановка при закрытии, pause/play по изображению,
стрелки ±5 секунд. Пользователь подтвердил работу перемотки и отсутствие большой
рамки; подсказка клавиш удалена. Реальный телефон и production ещё требуют проверки.
Подробности — `FIRST_SCREEN_ROADMAP.md`.

Предпочтение пользователя: сначала закончить согласованную правку, затем проверять;
не повторять lint/build после каждого небольшого изменения и не запускать отдельный
локальный сервер на 3100. Проверки перед деплоем выполнить один раз по готовому
набору изменений, повторять только при новых изменениях или сбоях.

## Выполнено: только сверка репозитория

- Frontend: Next `16.1.5`, React `19.2.3`; `npm run build` выполняет
  `next build --webpack`, `npm start` — `next start`; есть package-lock.
- `frontend/next.config.ts` разрешает изображения Cloudinary и настроен
  `output: "standalone"`; static export не используется.
- Используются `next/image`, public assets и `next/font/google` в layout.
- API base берётся из `NEXT_PUBLIC_API_URL` в `shared/api/api.ts`.
  Production-значение должно быть задано при сборке: `https://api.tapir.su/api`.
- Готовых frontend systemd/nginx конфигов и CI deploy pipeline в просмотренном
  репозитории изначально не было. Добавлен ручной workflow
  `.github/workflows/deploy-frontend-staging.yml`; он ещё не запускался и ждёт
  GitHub Secrets и подготовки VPS service.

## Выполнено: подготовка standalone release — 2026-09-08

- Выполнены `npm run lint` и production `npm run build` с
  `NEXT_PUBLIC_API_URL=https://api.tapir.su/api`; обе проверки успешны.
- Сборка создала `server.js` в `.next/standalone`. Измеренный размер до сжатия:
  standalone runtime — 70 MB, `.next/static` — 1.4 MB, `public` — 22 MB
  (всего около 94 MB). Это подтверждает достаточность текущих 9 GB свободного
  места на VPS для нескольких releases.
- Workflow запускается только вручную (`workflow_dispatch`), собирает в Linux
  Node 22, сохраняет артефакт на 7 дней и после будущей настройки секретов
  доставит его по SSH. До выполнения он не меняет VPS.
- Для GitHub Actions создана отдельная ED25519 deploy-пара, не использующая
  основной SSH-ключ Mac. Публичная часть добавлена для `tapiradmin` на VPS,
  а вход новым ключом подтверждён. ED25519 host key VPS сверена по доверенному
  SSH-каналу и подготовлена как known-hosts запись. Все четыре необходимых
  GitHub Actions Secrets добавлены вручную: host, user, private deploy key и
  known-hosts. В репозиторий они не записываются.
- На VPS созданы `/home/tapiradmin/travel-frontend/{incoming,releases}` с
  владельцем `tapiradmin`. Установлен и включён (но ещё не запущен)
  `travel-frontend.service`: standalone server будет слушать только
  `127.0.0.1:3020` и стартует лишь после появления `current/server.js`.
  Отдельный sudoers-файл прошёл `visudo` и разрешает `tapiradmin` без пароля
  перезапускать только этот unit; полного sudo для workflow не добавлено.
- Проверено тем же отдельным deploy-ключом: passwordless restart
  `travel-frontend.service` успешен. Unit `loaded` и `enabled`, но ожидаемо
  `inactive` до первого release.
- `systemd-analyze verify` подтвердил новый unit, но обнаружил не связанные с
  Travel warnings: `/usr/lib/systemd/system/linux.service` executable и
  `systemd-kworkerd.service`/`.timer` world-writable. Не исправлять их во
  время frontend migration; вынести в отдельный security audit.

## Выполнено: read-only аудит VPS — 2026-09-08

- Диск `/`: 30 GB, занято 21 GB (70%), свободно около 9 GB. Этого достаточно
  для двух компактных frontend releases, но не для рискованной сборки с полными
  зависимостями на VPS.
- RAM: 1.9 GiB, доступно около 1.1 GiB; используется около 1.1 GiB swap.
  Production build frontend выполнять в Linux CI; macOS `node_modules` на VPS
  не переносить.
- `travel-backend.service` — `active` и `enabled`, использует около 45 MB,
  слушает 3010. `nginx -t` успешен; warnings относятся к `table-booker.ru` и
  не входят в эту миграцию.
- Заняты 3000–3003 и 3010; порт `3020` отдельно проверен свободным для
  frontend. Новый service будет слушать `127.0.0.1:3020`.
  Nginx должен оставаться единственной публичной точкой входа.
- Известные потребители места: `/var/log/journal` — около 1.3 GB,
  `/home/project` — 1.9 GB, `/root` — 2.3 GB (`.npm`, `.cache`, `.local`),
  `/var/lib/docker` — 1.5 GB. `docker system df` показывает лишь около 40 MB
  безопасно reclaimable. Эти каталоги без отдельной проверки и согласования не
  удалять.
- Отдельный security/ops backlog: Docker proxy слушает `0.0.0.0:5432`; нужно
  выяснить назначение контейнера и необходимость внешнего доступа. Также нужно
  задать retention/лимит systemd journal. Не смешивать эти действия с frontend
  deploy. Дополнительно проверить и исправить ownership/mode существующих
  systemd units, отмеченных `systemd-analyze verify`.
- Выбранное направление: Linux CI → `output: "standalone"` → release
  directories на VPS с symlink на текущий release и хранением не более двух
  предыдущих версий. Ручное копирование и сборка на VPS не использовать.
- Для первого внешнего smoke выбран временный домен `staging.tapir.su`;
  frontend service будет на `127.0.0.1:3020`. `tapir.su` и `www.tapir.su`
  остаются прикреплёнными к Vercel до подтверждения VPS-версии, чтобы сохранить
  быстрый DNS/hosting rollback.
- Trigger первого pipeline: ручной `workflow_dispatch` в GitHub Actions, а не
  deploy по каждому push в `main`.

### Кандидаты на очистку — только при реальной необходимости

Текущих ~9 GB свободного места достаточно, чтобы начать frontend deploy без
очистки. До первого release ничего удалять не нужно; после доставки измерить
размер артефакта и сохранить запас для двух версий.

- `systemd-journald`: около 1.3 GB, специальных лимитов в конфигурации нет.
  При необходимости сначала задать постоянные `SystemMaxUse`/`SystemKeepFree`,
  затем штатно сжать старые журналы. Не удалять journal-файлы вручную.
- `/root/.npm`: около 731 MB, почти полностью npm `_cacache`; возобновляемый
  кэш, очищать только штатной npm-командой после отдельного подтверждения.
- `/root/.cache`: около 449 MB (`pnpm` metadata — 272 MB, Prisma cache —
  177 MB); очищать только штатными инструментами соответствующего runtime.
- `/root/.local/share/pnpm`: около 1.8 GB, pnpm store. До очистки выяснить
  структуру и root-owned глобальные пакеты; допустимый путь — `pnpm store prune`,
  не ручное удаление.
- `/home/tapiradmin/.npm` и `.cache`: около 715 MB пользовательских кэшей;
  низкий приоритет, так как они могут ускорять обычную работу на VPS.
- Не кандидаты: `/home/project` (root-owned Gustaw production project и его
  данные), Docker и локальная PostgreSQL. Не изменять их в рамках frontend
  migration.

## Запланировано: порядок реализации

### 1. Проверить площадку и сборку

- Свежая карта ресурсов, портов, сервисов и nginx снята 2026-09-08; см. раздел
  выше. Перед deploy повторить короткую проверку свободного места и сервисов.
- Использовать `127.0.0.1:3020`, отдельный каталог и frontend service; не
  занимать 3010 и не менять соседние приложения.
- Использовать Node server через standalone output. Отдельно проверить упаковку
  `public` и `.next/static`; не предполагать совместимость static export.
- Проверить production build с API env и загрузкой шрифтов. Где собирать —
  определить по ресурсам; для CI-артефактов учесть Linux/архитектуру и native deps,
  не переносить macOS node_modules на VPS.

### 2. Сделать ручной CI deploy из Git и откат

- Добавлен GitHub Actions: Linux build + доставка release по SSH. Первый
  trigger — ручной `workflow_dispatch`; следующий шаг — добавить credentials
  в GitHub Secrets и подготовить VPS к его запуску.
- Проверки и build → отдельный release directory → запуск/health smoke →
  переключение на release. При неуспехе сохранять предыдущий рабочий release.
- Зафиксировать commit, env для сборки, зависимости и команды возврата.
  Хранить предыдущие артефакты вместе с соответствующими static assets;
  не создавать окно, когда старый HTML ссылается на уже удалённые chunks.
- Проверить повторный деплой и rollback до production DNS. Ручное копирование
  при каждом изменении не удовлетворяет критерию готовности.

### 3. Поднять временный HTTPS-домен

- В DNS Timeweb создана запись `A staging.tapir.su → 91.210.170.148` с TTL
  600. Распространение подтверждено с самого VPS 2026-09-08: имя разрешается
  в `91.210.170.148`. Основные `tapir.su` и `www.tapir.su` не менялись и
  продолжают обслуживаться Vercel.
- Nginx vhost хранится в репозитории как
  `infra/travel-frontend/travel-frontend-staging.nginx`; до установки на VPS
  он должен быть проверен через `nginx -t`.
- Vhost установлен, включён и мягко применён через `systemctl reload nginx`.
  Certbot успешно выпустил и подключил сертификат Let's Encrypt для
  `staging.tapir.su` 2026-09-08; срок текущего сертификата до 2026-12-07,
  автоматическое продление настроено Certbot. Пока release не активирован,
  ожидаемый ответ proxy — `502` с `127.0.0.1:3020`.
- Отдельный systemd unit и nginx vhost с проксированием на выбранный порт,
  автозапуском и логами. Сначала проверить config и локальную доступность.
- Подготовить временный поддомен и сертификат, добавить его origin в CORS API
  при необходимости. Не переключать основной домен на этом этапе.
- Проверить HTML, /_next/static, public PNG, шрифты, next/image и Cloudinary,
  прямое открытие /login и /register, refresh и query URL.

### 4. Проверить на сетях пользователя

- Реальный телефон без VPN: Wi-Fi и сотовая сеть; дополнительно desktop.
- Дождаться полной загрузки JS, изображений и шрифтов; проверить интерактивность,
  all/страна/город, сортировку, авторизацию, likes/comments, upload и delete
  на согласованных тестовых данных.
- Сравнить временный VPS-домен и Vercel на одинаковом устройстве/сети.
  Зафиксировать дату, сеть, результаты и ошибки; один быстрый curl недостаточен.

### 5. Переключить основной frontend-домен

- Перед изменением сохранить фактические A/AAAA/CNAME/TTL и redirects.
  Исторические значения приведены в incident; заново сверить их с DNS-панелью.
- Подготовить HTTPS для `tapir.su` и `www.tapir.su`, сохранить canonical
  redirect `tapir.su → www.tapir.su` и разрешённые CORS origins.
- После успешного временного smoke переключить только frontend DNS на VPS.
  `api.tapir.su` и Neon оставить в текущем размещении.
- Повторить телефонный smoke и проверить TLS/redirects, static chunks,
  CORS и отсутствие запросов к старому Render URL в собранном frontend.

## Откат и критерии готовности

Сохранить Vercel deployment и записанные прежние DNS до подтверждения
стабильности. При сбое вернуть frontend DNS/redirects и рабочий Vercel deployment;
учесть TTL и проверить с телефона. API остаётся VPS. Откат release на VPS
и откат DNS — разные процедуры, обе должны быть описаны и проверены.

Готово: frontend устойчиво работает с основных доменов на Wi-Fi и сотовой сети,
автоматический Git deploy и откат испытаны, service автозапускается, TLS renewal
и логи настроены, соседние приложения и API работают. После проверки убрать
временный origin/domain, когда он больше не нужен.

## Требует проверки

Первый ручной CI deploy и сетевой результат переноса. Аудит ресурсов, runtime,
свободный порт,
standalone-сборка, SSH deploy key, GitHub Secrets и доступность шрифтов при build
подтверждены 2026-09-08.
В этой сверке изменены только документы; сборка, сервер, DNS и deployment
не менялись. Сжатие изображений не является согласованным исправлением инцидента.
