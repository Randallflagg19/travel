# Frontend на VPS: итоги миграции и эксплуатация

Закрыто пользовательской приёмкой на production 2026-09-09. Основной frontend
работает на `https://www.tapir.su`, а `staging.tapir.su` сохранён для проверки
будущих релизов. Это исторический журнал CI/deploy и rollback-контекста, не
текущий план работы; актуальная очередь — в [ROADMAP.md](ROADMAP.md).

Neon остаётся базой данных, Cloudinary — хранилищем медиа. Vercel сохранён как
временный rollback-вариант, но основной DNS на него больше не указывает.

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
  `.github/workflows/deploy-frontend-staging.yml`; GitHub Secrets, VPS service
  и первая доставка release подготовлены и проверены.

## Выполнено: подготовка standalone release — 2026-09-08

- Выполнены `npm run lint` и production `npm run build` с
  `NEXT_PUBLIC_API_URL=https://api.tapir.su/api`; обе проверки успешны.
- Сборка создала `server.js` в `.next/standalone`. Измеренный размер до сжатия:
  standalone runtime — 70 MB, `.next/static` — 1.4 MB, `public` — 22 MB
  (всего около 94 MB). Это подтверждает достаточность текущих 9 GB свободного
  места на VPS для нескольких releases.
- Workflow запускается только вручную (`workflow_dispatch`), собирает в Linux
  Node 22, сохраняет артефакт на 7 дней и доставляет его по SSH. Первый запуск
  2026-09-08 успешно прошёл сборку, упаковку и доставку; Next.js запустился,
  но workflow преждевременно отметил запуск неуспешным из-за мгновенного health
  check. Проверка изменена на ожидание готовности до 20 секунд; повторный
  ручной запуск завершился успешно (green) 2026-09-08.
- Для GitHub Actions создана отдельная ED25519 deploy-пара, не использующая
  основной SSH-ключ Mac. Публичная часть добавлена для `tapiradmin` на VPS,
  а вход новым ключом подтверждён. ED25519 host key VPS сверена по доверенному
  SSH-каналу и подготовлена как known-hosts запись. Все четыре необходимых
  GitHub Actions Secrets добавлены вручную: host, user, private deploy key и
  known-hosts. В репозиторий они не записываются.
- На VPS созданы `/home/tapiradmin/travel-frontend/{incoming,releases}` с
  владельцем `tapiradmin`. Установлен и включён `travel-frontend.service`:
  после первого release он active, запускает Next.js и слушает только
  `127.0.0.1:3020`.
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

## Результат переключения основного домена — 2026-09-09

- Выполнен preflight: `travel-frontend` active, staging отвечает `200`, на VPS
  свободно 8.5 GB; `nginx -t` успешен. Предупреждения относятся к чужому
  `table-booker.ru`.
- DNS переключён: `tapir.su A → 91.210.170.148`; `www.tapir.su CNAME → tapir.su`.
  `api.tapir.su` и `staging.tapir.su` не менялись. Прежняя настройка Vercel
  сохранена как быстрый rollback-вариант.
- На VPS установлен production Nginx-vhost, выпущен Let’s Encrypt-сертификат
  для обоих имён (до 2026-12-08, автопродление настроено). Канонический маршрут:
  `http://* → https://…`, `https://tapir.su → https://www.tapir.su`,
  `https://www.tapir.su → 200`.
- Пользовательский smoke успешен: главная открылась на iPhone через мобильную
  сеть и Wi-Fi без VPN, а также на Mac; вход и admin-удаление файла работают.
- Во время переключения один раз появились белый экран и client-side error.
  В журнале Next.js зафиксирован `Failed to find Server Action … older or newer
  deployment`: старые данные браузера от Vercel-релиза встретились с новым
  релизом на VPS. После обновления страницы сервис восстановился. Это не
  «гидратация» и не серверная недоступность: процесс и HTTPS в этот момент
  отвечали корректно. Вынести профилактику конфликтов кэша между релизами в
  отдельную техническую задачу, не смешивая с завершённой миграцией.

## Ближайшая первоочередная задача

- **Переключение основного frontend-домена на VPS выполнено.**
  2026-09-09 staging повторно проверен: desktop и iPhone, с VPN и без VPN,
  мобильная сеть и Incognito — без заметных задержек; авторизация, upload,
  admin delete и переключение hero-фото по всем согласованным местам работают.
  Перед изменением провести только короткий технический preflight (service
  `active`, staging HTTP 200, свободное место и актуальный DNS snapshot), затем
  выполнить раздел 5.
  После переключения наблюдать `tapir.su` и `www.tapir.su` на реальных сетях
  в течение дня; Vercel сохранить как быстрый откат.
- **Лишняя кнопка mobile sidebar убрана и проверена на staging.**
  Выдвижной sidebar дублировал mobile селектор страны и городов, поэтому
  hamburger и его `Sheet` удалены. На главной странице в освобождённой левой
  ячейке header теперь показывается корзина только для `ADMIN`/`SUPERADMIN`.
  Она включает существующий режим `?delete=1`; тогда на карточках появляются
  уже защищённые подтверждением кнопки удаления. Для гостя и обычного
  пользователя ячейка остаётся пустой. 2026-09-08 на staging подтверждены
  авторизация, upload и появление корзины для admin; режим удаления включается
  корректно.
- **Мобильная композиция hero и фотографий проверена на staging.** Для hero создан отдельный детерминированный
  crop `journal-template-mobile.png` (1440×900) из исходного desktop-файла:
  убран только лишний фон стола, журнал стал визуально крупнее. Mobile hero
  использует пропорцию `8:5`; его окно фотографии, текст и подпись пересчитаны
  под crop. На экране 390×844 его высота около 224 px (≈27%), то есть ниже
  лимита 40%. Desktop продолжает использовать исходный `1672:941` asset и
  прежнюю композицию. Для ленты добавлены единые боковые поля; видео остаются
  широкими `2:1`, фото на mobile получили рамку `3:2` вместо `2:1`, чтобы
  уменьшить обрезание без искажения. 2026-09-08 подтверждена визуальная работа
  на mobile; сайт открывается без VPN и на мобильной сети без ощутимых задержек.
- **Ускорить первичную загрузку фотографий.** Наблюдалась ощутимая пауза при
  открытии фотографии по нажатию и при догрузке карточек во время scroll.
  Сначала снять профиль сетевых запросов и размеров thumbnail/full-size
  изображений, затем выбрать минимальное исправление; проверить на iPhone и
  desktop, не ухудшая качество full-size просмотра.
- **Hero-фото по месту проверены на staging.** В
  `frontend/public/hero-photos/` сохранены оптимизированные
  JPEG: `thailand-bangkok-giraffes.jpg` (526 KB),
  `indonesia-bali-temple.jpg` (400 KB), `egypt-giza-pyramid.jpg` (362 KB).
  Они ограничены длинной стороной 1200 px и будут отдаваться напрямую,
  без request-time Next image optimizer. Соответствие: Thailand /
  Pattaya — существующий `me-hero.jpg`; Thailand / Bangkok — жирафы;
  Indonesia / Bali — храм; Egypt — пирамида; China — существующая
  Pattaya-фотография `me-hero.jpg`. Она же остаётся для «Все посты» и Thailand
  без выбранного города. Выбор централизован в
  `hero-photo-selection.ts`, а не разнесён по JSX; каждое фото может задать
  свою точку кадрирования. 2026-09-08 подтверждены «Все посты», China, Egypt,
  Indonesia, Thailand / Pattaya и Thailand / Bangkok на staging.

## Запланировано: порядок реализации

### 1. Проверить площадку и сборку

**Статус: выполнено для staging.**

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

**Статус: CI deploy выполнен; отдельный намеренный rollback ещё не проверялся.**

- Добавлен GitHub Actions: Linux build + доставка release по SSH. Trigger —
  ручной `workflow_dispatch`; credentials в GitHub Secrets и VPS service
  подготовлены. Повторный запуск проверил весь путь до активного release.
- Проверки и build → отдельный release directory → запуск/health smoke →
  переключение на release. При неуспехе сохранять предыдущий рабочий release.
- Зафиксировать commit, env для сборки, зависимости и команды возврата.
  Хранить предыдущие артефакты вместе с соответствующими static assets;
  не создавать окно, когда старый HTML ссылается на уже удалённые chunks.
- Проверить повторный деплой и rollback до production DNS. Ручное копирование
  при каждом изменении не удовлетворяет критерию готовности.

### 3. Поднять временный HTTPS-домен

**Статус: выполнено.**

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
  автоматическое продление настроено Certbot. После первого release проверены
  ответы `200` и с `127.0.0.1:3020`, и через HTTPS-vhost.
- Для staging добавлен `https://staging.tapir.su` в `CORS_ORIGIN` backend на
  VPS и перезапущен только `travel-backend`; 2026-09-08 подтверждены ответ
  API `200` и успешный CORS preflight для этого origin. Значения backend `.env`
  в репозиторий не записываются.
- Диагностика static assets: `https://staging.tapir.su/me.png` существует и
  отдаёт `200`, но имеет размер около 4.8 MB и на VPS выдаётся напрямую без
  CDN, поэтому может долго загружаться на мобильной сети/VPN. Маршрут Next.js
  `/icon.png` отдаёт `200`; legacy-путь `/favicon.ico` отдаёт `404`. Это не
  блокирует deploy, но требует отдельного решения по совместимому favicon.
  В инкогнито
  2026-09-08 воспроизведён `504 Gateway Timeout` у
  `/_next/image?url=/me.png...`; он оставляет белый hero-блок, а в тот же
  период может задерживать оптимизацию маскота. Причина — тяжёлый PNG в
  on-demand Next image optimizer на VPS. Исправлено: оригинальный `me.png`
  сохранён, добавлен `me-hero.jpg`
  (900×1200 JPEG, около 416 KB) и hero переведён на прямую выдачу этого файла
  без Next image optimizer. `npm run lint`, production build, ручной staging
  deploy и повторная проверка в Chrome Incognito прошли: hero загружается.
- После hero-fix deploy проверено хранение на VPS: свободно 8.6 GB; текущий
  release `4cdad…` (около 106 MB) active, а ещё два release по 105–106 MB
  оставлены как кандидаты для rollback. Всего frontend занимает 365 MB. В
  `incoming` остался 50-MB архив первого запуска `240446…`; он больше не нужен
  для работы, но не удалён, так как очистка не требуется при текущем запасе.
- В первом browser smoke 2026-09-08 Mac получил HTML, CSS, все Next.js chunks
  и RSC-навигацию со статусом `200`. Запросы Next image optimizer для `me.png`
  и маскота завершились `499` (клиент оборвал ожидание); это указывает на
  медленную доставку/оптимизацию изображений, а не на 4xx/5xx от VPS. В
  повторной проверке iPhone Safari получил HTML, CSS, все Next.js chunks,
  шрифты, image optimizer-ответы, `/icon.png` и client navigation
  `/login`/`/register` со статусом `200`. После исправления hero staging
  визуально загрузился на desktop в Incognito и на iPhone с VPN и без VPN.
  Функциональный smoke всё ещё требует проверки авторизации и операций с
  данными.
- Отдельный systemd unit и nginx vhost с проксированием на выбранный порт,
  автозапуском и логами. Сначала проверить config и локальную доступность.
- Подготовить временный поддомен и сертификат, добавить его origin в CORS API
  при необходимости. Не переключать основной домен на этом этапе.
- Проверить HTML, /_next/static, public PNG, шрифты, next/image и Cloudinary,
  прямое открытие /login и /register, refresh и query URL.

### 4. Проверить на сетях пользователя

**Статус: начато, но не завершено.**

- Реальный телефон без VPN: Wi-Fi и сотовая сеть; дополнительно desktop.
- Дождаться полной загрузки JS, изображений и шрифтов; проверить интерактивность,
  all/страна/город, сортировку, авторизацию, likes/comments, upload и delete
  на согласованных тестовых данных.
- Сравнить временный VPS-домен и Vercel на одинаковом устройстве/сети.
  Зафиксировать дату, сеть, результаты и ошибки; один быстрый curl недостаточен.

### 5. Переключить основной frontend-домен

**Статус: готово к выполнению после согласования.**

### Зафиксированное исходное состояние

- `staging.tapir.su → 91.210.170.148` обслуживает current release через nginx
  и `travel-frontend.service` на `127.0.0.1:3020`.
- На 2026-09-08 в панели Timeweb: `tapir.su A → 216.198.79.1` (Vercel),
  `www.tapir.su CNAME → f5d2dc3ff8378a98.vercel-dns-017.com`, TTL 600;
  перед изменением перепроверить и сохранить точные текущие значения.
- Backend/API остаётся без изменения: `api.tapir.su → 91.210.170.148`, Neon и
  Cloudinary не переносятся. `CORS_ORIGIN` уже содержит `https://tapir.su` и
  `https://www.tapir.su`.

### План переключения

1. Выполнить read-only preflight на VPS: `travel-frontend.service` active,
   staging HTTPS 200, место на диске, `nginx -t`, отсутствие занятого vhost для
   `tapir.su`/`www.tapir.su`. Зафиксировать текущие DNS и Vercel redirect.
   **Выполнено 2026-09-09:** service `active`, staging `200`, свободно 8.5 GB;
   `nginx -t` успешен, `server_name` есть только для `api.tapir.su` и
   `staging.tapir.su`. Warnings относятся к `table-booker.ru` и не входят в
   перенос. DNS snapshot подтверждён: `tapir.su A 216.198.79.1`,
   `www.tapir.su CNAME f5d2dc3ff8378a98.vercel-dns-017.com`,
   `api.tapir.su A 91.210.170.148`, TTL 600.
2. Добавить в репозиторий production nginx-конфиг: `www.tapir.su` проксирует к
   `127.0.0.1:3020`, `tapir.su` делает постоянный redirect на
   `https://www.tapir.su$request_uri`. Проверить конфиг до применения; staging
   vhost не менять.
   **Подготовлено локально:**
   `infra/travel-frontend/travel-frontend-production.nginx`. До выпуска
   сертификата он использует HTTP redirect на `www`; после DNS propagation
   Certbot добавит HTTPS и redirect будет приведён к `https`.
   **Установлено на VPS 2026-09-09:** vhost размещён как
   `/etc/nginx/sites-available/travel-frontend-production`, включён симлинком
   в `sites-enabled`; `nginx -t` успешен и применён через `systemctl reload
   nginx`. Публичный DNS на этом шаге не менялся. Direct-IP проверка с
   `--resolve` успешна: `www` отдаёт Next.js `200`, apex — `308` на
   `http://www.tapir.su/`.
3. В Timeweb заменить только frontend DNS: `tapir.su A` на `91.210.170.148` и
   `www.tapir.su CNAME` на `tapir.su` (либо A на тот же IP, если панель не
   разрешит CNAME). `api.tapir.su` не трогать. Vercel domains не отключать —
   они нужны для rollback.
   **Выполнено 2026-09-09:** `tapir.su A → 91.210.170.148`,
   `www.tapir.su CNAME → tapir.su`, TTL 600. После распространения с VPS
   подтверждены обе записи и конечный `www.tapir.su A → 91.210.170.148`.
4. После того как оба имени публично разрешаются в VPS, выпустить Let's Encrypt
   сертификат на `tapir.su` и `www.tapir.su` через Certbot, применить nginx
   мягким reload и проверить canonical redirect.
   **Выполнено 2026-09-09:** Certbot выпустил и развернул единый сертификат для
   обоих имён в `travel-frontend-production`; текущий срок до 2026-12-08,
   автоматическое продление настроено. Проверка выявила один лишний redirect:
   `https://tapir.su → http://www.tapir.su → https://www.tapir.su`; перед
   пользовательским smoke изменить первый на прямой `https://www…`, затем
   повторить проверку redirects. **Исправлено 2026-09-09:** после изменения
   production vhost и `nginx -t`/reload подтверждено
   `https://tapir.su → 308 https://www.tapir.su/`; `https://www.tapir.su`
   отдаёт Next.js `200`.
5. Провести smoke на desktop и iPhone: Wi-Fi, сотовая сеть, VPN/без VPN и
   Incognito; проверить HTML, static chunks, hero/public assets, API/CORS,
   авторизацию, upload и admin delete. Наблюдать сутки.

**Ожидаемое короткое окно:** после DNS change и до выпуска сертификата HTTPS
может несколько минут отдавать не тот сертификат у части клиентов. Это нельзя
исключить без заранее выпущенного сертификата через DNS-01; будем держать
production nginx конфиг и Certbot-команду готовыми, чтобы сократить окно до
минимума.

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

Сетевой результат переноса и функциональный smoke staging на реальных
устройствах. Аудит ресурсов, runtime, свободный порт,
standalone-сборка, SSH deploy key, GitHub Secrets и доступность шрифтов при build
подтверждены 2026-09-08.
В этой сверке изменены только документы; сборка, сервер, DNS и deployment
не менялись. Сжатие изображений не является согласованным исправлением инцидента.
