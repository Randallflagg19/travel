# Лайки — чеклист перед пушем бэкенда

## Backend (проверено)

### 1. Роуты и охрана
- **GET /api/posts** — `OptionalJwtAuthGuard`: при валидном Bearer в `req.user` попадает JWT payload, иначе запрос идёт без пользователя (401 нет).
- **POST /api/posts/:id/like** — `AuthRoles('USER', 'ADMIN', 'SUPERADMIN')`: только залогиненные с ролью USER+.
- **DELETE /api/posts/:id/like** — то же.

### 2. Контроллер постов (GET list)
- `@CurrentUser() user: JwtUser | null` — пользователь или `null`.
- В `listPage` передаётся `userId: user?.sub` — при наличии токена бэк знает, кто запрашивает.

### 3. PostsService.listPage
- Принимает `userId?: string`.
- Если `params.userId` задан и не пустой:
  - Запрос: `SELECT post_id FROM likes WHERE user_id = $1::uuid` (без массива, без ANY).
  - По ответу строится `likedSet` и для каждого поста выставляется `liked_by_me = likedSet.has(p.id)`.
- Иначе для всех постов `liked_by_me = false`.

### 4. LikesService
- **like(postId, userId):** `INSERT INTO likes (user_id, post_id) VALUES (...) ON CONFLICT DO NOTHING` — дубликат не создаётся.
- **unlike(postId, userId):** `DELETE FROM likes WHERE user_id = ... AND post_id = ...`.

### 5. Миграции
- Таблица `likes`: `PRIMARY KEY (user_id, post_id)` — один лайк на пару (user, post).
- Индекс `likes_post_id_idx` на `post_id`.

### 6. Сборка
- `yarn lint` и `yarn build` проходят.

---

## Frontend (для справки)

- Токен подставляется только после гидрации: `enabled: isSelectionReady && auth.hydrated`, первый запрос постов идёт уже с токеном.
- `fetchPostsPage(..., accessToken)` при наличии токена шлёт `Authorization: Bearer <token>`.
- После успешного like/unlike вызывается `queryClient.invalidateQueries({ queryKey: ["posts"] })` — рефетч даёт актуальные `liked_by_me` и счётчик.

---

## Ожидаемое поведение после деплоя

1. Загрузка/перезагрузка с залогиненным пользователем → посты, которые он лайкнул, приходят с `liked_by_me: true` → сердце красное.
2. Клик по красному сердцу → unlike → сердце серое, счётчик −1.
3. Клик по серому → like → сердце красное, счётчик +1.
4. После like/unlike рефетч подтягивает состояние с сервера → сердце и счётчик совпадают с БД.
