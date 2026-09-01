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

Текущий практический фокус: сделать первую загрузку понятной для пользователя и
улучшить мобильную навигацию по местам.

Почему это следующий фокус:

- Render Free cold start, скорее всего, не проблема кода, а свойство инфраструктуры.
- Пользователь не должен смотреть на hero и гадать, живо ли приложение: нужно явно
  показывать, что лента и места загружаются с сервера.
- Сейчас на мобильной версии плашки мест доступны через горизонтальный scroll. Это
  работает, но воспринимается хуже, чем простая сетка видимых вариантов.
- Первый полезный UX-fix: показать понятный loading state и после загрузки вывести
  места на mobile сеткой, например по 3 иконки в ряд с названием страны.

Что сделать первым:

1. Добавить явную плашку/состояние загрузки для server data: places и первой страницы
   posts.
2. Текст должен объяснять не абстрактное "Loading", а смысл: например "Загружаем
   места и первые посты".
3. На mobile заменить горизонтальный список глав на сетку: 2-3 элемента в ряд,
   иконка + название страны/раздела, без необходимости свайпать слева направо.
4. Проверить состояние до загрузки places: пользователь должен понимать, что список
   мест еще придет с сервера.
5. Проверить после загрузки: страны/города остаются читаемыми, активный раздел виден,
   Thailand с Bangkok/Pattaya по-прежнему работает.

Где смотреть:

- `frontend/src/features/feed/ui/feed.tsx`
- `frontend/src/features/feed/ui/mobile-chapters.tsx`
- `frontend/src/features/feed/model/mobile-chapters.ts`
- `frontend/src/features/places/ui/mobile-places.tsx`
- `frontend/src/features/places/ui/places-sidebar.tsx`

Гипотеза по cold start:

- Теплый backend отвечает быстро: `/places` около `0.37s`, `/posts?limit=9&order=desc`
  около `0.16s`.
- На Render Free backend instance засыпает при неактивности, и Render сам предупреждает
  о задержке до `50s+` на первом запросе.
- Если warm load быстрый, а первый визит после паузы долгий, главная гипотеза:
  тормозит не React-компонент и не Cloudinary, а холодный старт backend process на Render.
- Сначала нужны измерения, потом решение: оставить Render, перейти на платный план,
  настроить keep-alive или перенести текущий Nest backend на свой Timeweb-сервер.

Команды для проверки cold start после долгого простоя:

```bash
date
curl -sS -o /dev/null -w "places: %{time_total}s\n" https://travel-313c.onrender.com/places
curl -sS -o /dev/null -w "posts: %{time_total}s\n" "https://travel-313c.onrender.com/api/posts?limit=9&order=desc"
```

Правило проверки:

- Выполнить команды до открытия сайта, Render dashboard или любых вкладок, которые могут
  разбудить backend.
- Если первый запрос занимает `20-60s`, а следующий сразу `0.1-1s`, это почти точно
  Render cold start.
- Если оба запроса быстрые, надо искать задержку в браузере: JS chunks, auth hydration,
  Cloudinary images, rendering или client-side cache/state.

Соседние направления, но не текущий фокус:

- FSD/import boundaries: проверить, не импортируют ли `features` друг друга слишком
  свободно, не течет ли UI в model/shared, и не стоит ли ввести более строгие правила.
- API layer cleanup: большой `frontend/src/shared/api/api.ts` постепенно разделить по
  доменам (`posts`, `places`, `auth`, `upload`), но не смешивать это с cold-start
  расследованием.
- UI/performance polishing: INP, skeleton states, modal accessibility и визуальные
  детали, но после понимания причины первой загрузки.
- Data correction/admin tooling: уметь менять `country/city/folder` у уже созданного
  post, чтобы исправлять случаи вроде ролика, который должен быть в `Indonesia / Bali`,
  но в базе числится как `Thailand / Bangkok`.
- API/frontend orchestration cleanup: `frontend/src/shared/api/api.ts` стал большим
  файлом всех запросов сразу, а часть mutation orchestration (`deletePost`,
  optimistic like update, upload success -> createPost) живет слишком близко к UI.
- Upload reliability: Cloudinary signed upload должен подписывать ровно те параметры,
  которые виджет отправляет в `paramsToSign`, включая timestamp виджета.

## Завершенные практические шаги

Практический шаг завершен: нормализовать backend contract для places/posts.

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

Практический шаг завершен: сделать `Feed` более понятным orchestrator-компонентом.

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
- `POSTS_PAGE_LIMIT` получил явное имя вместо локального `limit`.
- `buildPostsCountryCityFilter` вынесен в `features/feed/model/posts-query-params.ts`.
- Derived selection state вынесен в `useFeedSelectionState`.
- Expanded post modal state/refs/callbacks вынесены в `useExpandedPostModal`.
- Comments opening state/refs/callback вынесены в `useOpenFeedComments`.
- Hero image заменен на более живую travel-заставку.

Что стало заметно после UI-extract:

- JSX в `Feed` уже не главная проблема.
- Основная сложность теперь в orchestration: URL params, places query, posts query, derived selection state, infinite scroll, expanded modal, delete post, optimistic like update, comments open state.
- Большие тернарники в posts rendering ухудшают читаемость, но это не первая архитектурная боль.
- Появился обратный риск: файлов стало больше, а часть компонентов содержит мало собственной логики. Это может улучшать локальную читаемость, но ухудшать навигацию по проекту.
- Простое правило "один видимый кусок JSX = отдельный файл" здесь не подходит. Нужны более крупные смысловые границы.

Вывод по `Feed`:

- Дальше не стоит просто дробить `Feed` на еще больше мелких UI-файлов.
- Более полезно выделять смысловые orchestration-куски: posts query, feed selection state, expanded modal behavior, comments open behavior.
- Для UI-компонентов лучше держать баланс: если компонент только прокидывает 2-3 props и не дает имени важной идее, возможно, он не нужен отдельным файлом.
- `FeedHero`, `MobileChapters` и `CitySelection` пока оправданы: это крупные визуальные блоки с понятной ролью.
- Следующий refactor должен либо уменьшать mental load в `Feed`, либо убирать реально повторяющуюся/сложную логику. Само уменьшение числа строк больше не цель.
- Останавливаемся на текущем компромиссе: `Feed` остается orchestrator-компонентом, а не превращается в набор мелких wrapper-файлов.

Что сделали в ручном refactor:

- Дали явное имя константе `POSTS_PAGE_LIMIT`.
- Вынесли расчет country/city фильтра posts query.
- Вынесли derived selection state.
- Вынесли expanded modal behavior.
- Вынесли comments opening behavior.
- Проверили руками: выбор `Thailand -> Bangkok/Pattaya`, comments add/delete, modal overlay, hero image.
- Упростили hero copy: убрали лишний runtime-текст про число кадров в ленте на desktop.

Практический шаг завершен: первый refactor `FeedPostCard`.

Почему именно он:

- `FeedPostCard` получает слишком много props.
- Внутри смешаны media preview, overlay/actions, delete post UI, like mutation orchestration, comments toggle и place/text rendering.
- Like flow уже разобран, поэтому можно рефакторить осторожно и понимать, что нельзя сломать.
- Главный вопрос этапа: должна ли карточка сама orchestrate like mutation, или она должна стать более чистым UI-компонентом?

Текущие ответственности `FeedPostCard`:

1. Root card shell: внешний `Card`, hover/overflow/visual container.
2. Delete post UI: кнопка удаления поста в `deleteMode`.
3. Media preview: выбор video/photo preview, Cloudinary urls, play overlay, preload full photo.
4. Visual overlay: top/bottom gradients и badge `PHOTO`/`VIDEO`.
5. Post info/actions: text, place/coords, like button, comments button.
6. Comments slot: условный рендер `PostCommentsBlock`.

Что сделали:

1. Перечитали `FeedPostCard` и перечислили его ответственности.
2. Вынесли безопасный UI-only кусок media preview в `PostMediaPreview`.
3. Переименовали короткий alias `p` обратно в более читаемый `post`.
4. Вынесли like orchestration в `usePostLikeToggle`.
5. Оставили DOM click plumbing (`preventDefault`, `stopPropagation`) внутри `FeedPostCard`, потому что это UI-поведение.

Что вынесли:

- Создать `features/feed/ui/post-media-preview.tsx`.
- Вынести туда video/photo branch из `FeedPostCard`.
- Оставить root `Card`, delete post button, overlays/actions и comments slot в `FeedPostCard`.
- Props нового компонента держать минимальными: `post` и `onOpen`.
- `preloadExpandedMedia` переезжает вместе с media preview, потому что относится к поведению preview.
- Создать `features/feed/model/use-post-like-toggle.ts`.
- Вынести туда `likePending`, auth check, переход на `/login`, optimistic update call, API call, success callback и rollback.

Что стало лучше:

- `FeedPostCard` меньше знает о сценарии лайка.
- UI-компонент по-прежнему знает о клике, но не содержит весь mutation flow.
- Like flow стал отдельной учебной единицей: его можно читать без JSX карточки.

Кандидаты на потом:

- `PostCommentsBlock`: вынести список комментариев в `CommentsList`, не меняя query/mutation logic.
- `PostCommentsBlock`: вынести форму отправки в `CommentForm`, оставив submit handler во внешнем блоке.
- `Feed`: отдельно разобрать posts query / delete post / optimistic update hooks, если `Feed` снова начнет разрастаться.
- `FeedPostCard`: подумать над `PostCardActions` или `PostCardMeta`, только если это уменьшит props/mental load, а не создаст лишние мелкие wrapper-компоненты.

Правило этапа:

- Сначала дробим JSX и визуальные куски.
- Mutation orchestration переносим только когда она уже понята как отдельный flow. С лайком это сделано; comments cache пока не трогаем.
- Если пропсов становится больше, чем было, останавливаемся и обсуждаем границу компонента.
- После каждого шага запускать `cd frontend && npx tsc --noEmit` и `cd frontend && npm run lint`, плюс smoke-test `Thailand -> Bangkok/Pattaya`.

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

Текущее понимание:

- Cloudinary хранит сами файлы.
- Backend/database хранит post record: `country`, `city`, `folder`, `media_url`,
  `cloudinary_public_id`, counters и остальную модель приложения.
- Frontend строит ленту из backend API, а не из структуры папок Cloudinary.
- Upload через приложение идет по цепочке `frontend -> backend -> Cloudinary ->
  backend/database -> frontend cache invalidation`.
- Сейчас после успешного upload post создается, но UI может не обновиться сразу:
  нужно явно инвалидировать/refetch `posts` и `places` queries после `createPost`, чтобы
  новая карточка и счетчики появились без ручного refresh.
- Delete через приложение идет по цепочке `frontend -> backend`, а backend удаляет
  запись из базы и asset из Cloudinary.
- Ручной move/delete в Cloudinary не уведомляет backend. Post record в базе не меняется,
  поэтому карточка может остаться в ленте. Медиа может временно продолжать открываться
  из-за browser/CDN cache, даже если asset уже удален или перемещен в Cloudinary UI.
- Папка Cloudinary не является источником правды для географии поста. Источник правды:
  `country/city/folder` в базе.
- `cloudinary_public_id` у текущих записей хранится без папки, а `folder` хранится
  отдельным полем. Поэтому перенос asset между Cloudinary folders сам по себе не
  меняет `country/city/folder` у post record.
- Invalid Signature на signed upload был связан с подписью: Cloudinary widget присылает
  `paramsToSign`, включая свой `timestamp`, и backend должен подписывать именно этот
  набор параметров. Если backend генерирует новый timestamp, строка подписи не совпадает.
- После исправления подписи video upload в `Indonesia / Bali` проходит: asset появился
  в Cloudinary, post появился во frontend после refresh/догрузки.
- Отдельную фичу `move post location` пока не делаем: для единичных ошибок проще
  удалить/перезалить или вручную исправить запись в базе.

Следующий практический шаг:

- Исправить upload UX/cache: после успешного `createPost` сразу обновлять `posts` и
  `places`, чтобы новая карточка и счетчики появлялись без ручного refresh.
- Исправить состояние кнопки Upload: `busy` не должен сбрасываться сразу после
  `widget.open()`, потому что Cloudinary widget открывается не синхронно. Сбрасывать
  состояние нужно по событию widget (`display-changed`, `close`, error).
- При смене выбранного раздела пересоздавать Cloudinary widget для нового `folder`, иначе
  уже созданный widget может продолжить грузить в старую папку.

Файлы:

- `frontend/src/features/upload/ui/cloudinary-upload-button.tsx`
- `frontend/src/shared/api/api.ts`
- `backend/src/cloudinary/cloudinary.controller.ts`
- `backend/src/posts/posts.controller.ts`
- `backend/src/posts/posts.service.ts`

Вопросы:

- Кто имеет право upload?
- Какая папка используется для media?
- Какие `country` / `city` metadata прикрепляются к post?
- Что происходит, если пользователь поменял место после создания widget?
- Upload обновляет или инвалидирует feed/places cache после создания post?
- Как upload должен вести себя в состоянии `country-needs-city`?
- Как upload должен поддерживать country-level destinations без риска создать post в стране, где нужно выбрать город?
- После `createPost` в upload callback добавить TanStack invalidation/refetch для
  `posts` и `places`.
- После клика Upload держать кнопку в состоянии подготовки до фактического открытия
  Cloudinary widget, а не только до вызова `open()`.
- Отдельно проверить delete media flow: при удалении поста удаляется ли файл из
  Cloudinary или только запись из базы/ленты.
- Нужна ли admin-фича `move post` / `edit post location`, которая меняет `country`,
  `city`, `folder` в базе и, опционально, синхронизирует расположение asset в Cloudinary?
- Для текущего кейса с роликом: быстрый ручной путь — удалить post через приложение и
  заново загрузить в правильный раздел. Правильный продуктовый путь — сделать backend
  endpoint для изменения места существующего post, но сейчас это не оправдывает
  сложность.
- Еще один быстрый ручной путь для единичной правки: изменить строку `posts` в базе
  (`country`, `city`, `folder`) по `id` post. Это исправляет ленту и places counts, но
  требует аккуратно найти правильный `id`.

Технические запахи, которые заметили по пути:

- `frontend/src/shared/api/api.ts` содержит слишком много доменов сразу: posts, likes,
  comments, auth, upload/cloudinary.
- `frontend/src/features/upload/ui/cloudinary-upload-button.tsx` выглядит как UI-компонент,
  но внутри содержит сценарий загрузки, подписи Cloudinary widget и создания post.
- `frontend/src/features/feed/ui/feed.tsx` все еще содержит mutation orchestration:
  `handleDeletePost` и cache invalidation.
- `updatePostLike` в `Feed` управляет TanStack cache и выглядит как отдельная model/helper
  ответственность, хотя переносить это стоит только отдельным шагом.
- `CloudinaryUploadButton` строит folder из `auth.user.username`; если username отличается
  регистром (`Tapir` вместо `tapir`), Cloudinary может создать параллельную папку. Нужно
  решить, нормализуем ли root folder к lowercase или храним явный `cloudinaryRoot`.
- Invalid Signature при upload: backend не должен генерировать новый timestamp для
  function signature, а должен использовать timestamp из Cloudinary widget params.

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

Статус: cold-start investigation стал текущим направлением после завершения маленького
refactor `FeedPostCard`. Ближайшая практическая задача — не ускорять наугад, а
сделать ожидание загрузки понятным и улучшить mobile places navigation.

Наблюдения:

- Vercel Toolbar показал INP issue: event handlers заблокировали UI примерно на `421ms`.
- Delete confirmation modal для комментария визуально вел себя странно при скролле/смещении карточки; исправлено через portal, но accessibility-доработки оставлены на потом.
- Нужно отдельно проверить, относится ли INP issue к places navigation, feed card actions, comment modal или toolbar/dev overlay.
- На мобильной версии и при холодной первой загрузке долго видны skeleton-заглушки стран/разделов.
- В Network видно, что `/places` после прогрева может отвечать быстро (`~148ms`), но холодный запрос наблюдался заметно дольше (`~1.2s`).
- Первичная загрузка постов всё ещё может ощущаться долгой, даже если повторные запросы после cache/warm-up быстрые.
- В UI не всегда достаточно ясно показано, что именно сейчас грузится: places navigation или первая страница posts.
- Теплые terminal-замеры показали быстрый backend: `/places ~0.37s`, `/posts ~0.16s`.
- Render Free прямо предупреждает, что instance может засыпать и первый запрос после простоя может задерживаться на `50s+`.
- На mobile текущие chapter cards скроллятся горизонтально; это скрывает часть
  вариантов и хуже подходит для короткого списка стран/разделов.

Что делаем сейчас:

- Не меняем код наугад.
- Показываем явное состояние загрузки server data, чтобы пользователь понимал, что
  приложение ждёт backend, а не просто зависло на hero.
- Для mobile places/chapters меняем горизонтальный scroll на сетку: ориентир —
  3 элемента в ряд, иконка + название, без длинного описания.
- Cold start продолжаем измерять через `curl`, но не блокируем UX-улучшение этим
  исследованием.

Что сделать позже:

- Воспроизвести INP issue локально без лишних overlays, если возможно.
- Отдельно сравнить cold load и warm load для `/places` и первой страницы `/posts`.
- В DevTools Network смотреть `Timing`: TTFB, content download, initiator, cache status.
- Проверить, есть ли на Render cold start или задержка database connection для первых запросов.
- Решить, нужен ли отдельный `PERFORMANCE_NOTES.md`, если измерений станет больше одного-двух наблюдений.
- Проверить click handlers в places/sidebar/feed card/comment modal.
- Разобрать ownership delete confirmation modal.
- После диагностики предложить маленькое UI/performance изменение.

Критерии готовности ближайшего UX-fix:

- На холодной загрузке видно понятное сообщение о загрузке мест/постов.
- На mobile места не спрятаны в горизонтальный scroll.
- Активный раздел визуально различим.
- `all`, direct city feed, country-level feed и `Thailand -> Bangkok/Pattaya`
  сохраняют текущее поведение.

## Недавний cleanup

- Убран deprecated `baseUrl` из `backend/tsconfig.json`.
- Backend build после этого проходит.
