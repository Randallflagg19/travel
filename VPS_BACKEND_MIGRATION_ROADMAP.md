# Backend на VPS: итоги миграции и эксплуатация

Обновлено 2026-09-07. Миграция с Render **выполнена** 4 сентября по журналу
работ и подтверждена пользователем. Это не очередной этап переноса backend.
[Общий порядок](ROADMAP.md) · [Будущий перенос frontend](VPS_FRONTEND_MIGRATION_ROADMAP.md).

## Выполнено: итоговая конфигурация по журналу

- VPS Timeweb: `91.210.170.148`, пользователь `tapiradmin`.
- Backend: `/home/tapiradmin/travel-backend/backend`, entrypoint `dist/main.js`.
- Управление: `/etc/systemd/system/travel-backend.service`, **systemd, не pm2**.
  ExecStart: `/usr/bin/node /home/tapiradmin/travel-backend/backend/dist/main.js`;
  рабочий каталог и env — в указанной backend-директории.
- Внутренний порт `3010`; nginx site `travel-api` проксирует
  `api.tapir.su` на `http://127.0.0.1:3010`, сохраняя `/api`.
- `A api.tapir.su → 91.210.170.148`; публичный API `https://api.tapir.su/api`.
- 3 сентября проверены restart и `active/enabled`; 4 сентября — nginx и HTTPS.
  Let's Encrypt выдан 4 сентября до 3 декабря 2026, настроено автопродление.
  Успешный реальный reboot и последующее продление отдельно не подтверждены.
- 4 сентября Vercel production env переключён на
  `NEXT_PUBLIC_API_URL=https://api.tapir.su/api`, frontend пересобран.
- В 20:22 исправлен CORS новых доменов:
  `https://travel-coral-five-50.vercel.app,https://www.tapir.su,https://tapir.su`.
- Neon остаётся БД; Cloudinary хранит медиа. Переноса PostgreSQL на VPS нет в плане.

Исторические контрольные результаты 4 сентября: HTTPS health 200 около 0.10s,
DB health 200 около 0.13s; пользователь подтвердил быструю загрузку стран/ленты.
Это не свежий мониторинг. Старый Render backend давал около 31–33s после простоя
и 0.15–0.25s в тёплом состоянии; ожидание Render cold start больше не текущий план.

## Что подтверждает репозиторий

- `backend/src/main.ts`: prefix `/api`, `PORT`, список CORS origins через запятую.
- `app.controller.ts`: health и health/db; `db.service.ts`: `ssl: 'require'`.
- `db-migrations.service.ts`: миграции на старте только при
  `DB_MIGRATE_ON_START=true`. Для будущих нескольких экземпляров нужен отдельный порядок.
- `package.json`: Nest build и `node dist/main`; lint и lint:fix уже разделены.

Код не доказывает актуальные DNS, firewall, env, unit и состояние сервера.
`app.listen(PORT)` не ограничивает bind loopback: внешний доступ к 3010 нужно
проверить firewall/listener-проверкой, а не считать закрытым из-за nginx.

## Конфигурация и эксплуатационные проверки

Нужны `NODE_ENV=production`, `PORT=3010`, `CORS_ORIGIN`, `DATABASE_URL` (Neon),
`DB_MIGRATE_ON_START`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Значения секретов не коммитить.
Origin задаётся без `/api`; публичный API URL frontend — с `/api`.
Смена JWT_SECRET инвалидирует существующие JWT: журнал первого запуска говорит
о generated secret и не подтверждает совпадение с прежним Render secret.

Для будущей проверки на VPS:

```bash
systemctl is-active travel-backend
systemctl is-enabled travel-backend
systemctl cat travel-backend
journalctl -u travel-backend -n 100 --no-pager
ss -tulpn
free -h
df -h
```

Публичные проверки:

```bash
curl -fsS https://api.tapir.su/api/health
curl -fsS https://api.tapir.su/api/health/db
curl -fsS 'https://api.tapir.su/api/posts?limit=9&order=desc'
curl -sS -D - -o /dev/null -H 'Origin: https://www.tapir.su' 'https://api.tapir.su/api/posts?limit=1'
```

Не публиковать вывод unit/logs без проверки на секреты. Для эксплуатационного
мониторинга выбрать внешний health check, лимиты journald/log retention,
контроль диска/RAM и использования Neon/Cloudinary. Наличие такого мониторинга
и проверка certbot renewal пока не подтверждены.

## Полезная история сервера: не инструкция повторить установку

- 3 сентября Ubuntu 24.04.2, RAM 1.9Gi, swap 6Gi, диск 30G:
  около 21G занято и 9.1G свободно. Это устаревающий snapshot.
- Установка NodeSource блокировалась apt locks и half-configured ca-certificates.
  Trace показал пустую строку из find pipeline и попытку создать `/etc/ssl/certs/.pem`.
  `/usr/bin/find` оказался необычным statically linked Go binary.
  Временный guard `[ -n "$crt" ] || continue` в update-ca-certificates позволил
  завершить dpkg; затем переустановлен findutils. Получен GNU find 4.9.0,
  no-match перестал выдавать лишний newline, `dpkg --audit` был пуст.
  Происхождение подмены и дальнейшее состояние временного патча не установлены.
- После установки зафиксированы Node `v22.23.2`, npm `10.9.8`,
  `/usr/bin/node`, `/usr/bin/npm`, corepack `0.34.6`.
- npm install backend прошёл (исторический audit: 31 vulnerability), но две
  попытки `nest build` оборвали SSH и не создали dist. Причина не установлена;
  нельзя утверждать доказанный OOM. Backend собрали на Mac, dist передали rsync,
  зависимости установили на VPS. Это разовая тактика, не автоматический деплой.
- Foreground-процесс остановился в `Tl`, временный nohup запустился.
  Затем выбран systemd из-за неработоспособного вывода pm2 list/jlist.
  Первый service start потребовал SIGCONT, следующий restart прошёл без него.
- Сервер разделяется с `gustaw.ru`, `table-booker.ru`, `api.table-booker.ru`.
  Исторически заняты 3000–3003, 80/443, 5432, 5433 (локально), 10050,
  50051 (локально); nginx направлял gustaw на 5555/3000, table-booker на 3003,
  его API на 3001/3002. 3010 теперь занят Travel backend.
- Root/user pm2 daemons были в Tsl, старые npm-процессы в Tl;
  отмечались zombies и pending updates. После Node upgrade соседние сайты
  отдавали 200, но совместимость их будущих restart/reboot этим не доказана.
  Не выполнять массовый pm2 restart/kill, cleanup или reboot без карты сервисов.

## Требует проверки / оставшийся эксплуатационный backlog

- Свежие ресурсы, listener/firewall (в том числе исторически публичный 5432),
  системные обновления, stopped-процессы и состояние пакетных утилит.
- Текущие unit/env/runtime, nginx/TLS и автопродление; полный браузерный smoke
  auth, upload/create/delete, comments/likes после переключения ранее не зафиксирован.
- Доступность и пригодность Render для отката: `https://travel-313c.onrender.com/api`.
  Его предлагали оставить на несколько дней; факт сохранности сегодня неизвестен.
  Перед использованием сверить health, совместимость кода/БД, CORS и JWT secret.
  Только затем можно вернуть frontend API env на Render и пересобрать frontend.
- Повторяемое обновление backend с версионированными артефактами и откатом.
  В репозитории нет подтверждения готового серверного deploy pipeline.

Историю собственного frontend-домена и отдельного сетевого сбоя см. в
[инциденте](VERCEL_CUSTOM_DOMAIN_INCIDENT.md). Ожидание propagation и повторная
настройка API nginx не являются оставшимися шагами этой завершённой миграции.
