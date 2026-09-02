# Travel Roadmap

Этот файл — рабочая карта проекта Travel и учебный журнал решений.

Он отвечает на четыре вопроса:

- что сейчас работает;
- что мы уже сделали;
- что делать следующим шагом;
- какие темы не забыть, но не трогать прямо сейчас.

Отдельный senior-review лежит в `REVIEW_LEARNING_ROADMAP.md`. Там больше про
аудит проекта и порядок обучения. Этот файл — про текущую работу руками.

## Текущий статус

Проект уже является рабочим MVP:

- Next frontend показывает travel feed, hero, sidebar/mobile navigation, карточки
  фото/видео, likes, comments, delete mode и upload.
- Nest backend отдает posts/places, работает с auth/roles, comments, likes,
  Cloudinary и Postgres/Neon.
- Media хранится в Cloudinary.
- Источник правды для приложения — база данных, а не структура папок Cloudinary.
- Frontend deploy: Vercel.
- Backend deploy: Render.
- Database: Neon.
- Render Free может засыпать, поэтому первый backend request после простоя может
  быть долгим. Теплые запросы уже измерялись и были быстрыми.

## Сегодняшний Фокус

На 2026-09-02 лучший день делим на два результата:

1. Быстрый видимый результат: начать перенос выбранного first-screen направления
   `road journal / archive desk` в реальный UI.
2. Учебный инженерный результат: после визуального шага вернуться к upload feature
   refactor и разнести `CloudinaryUploadButton` по понятным границам.

Почему так:

- Первый экран — то, что можно показать в LinkedIn, и он даст быстрый эмоциональный
  результат.
- Upload — главная интерактивная feature проекта, и ее refactor даст инженерную
  пользу.
- Если весь день потратить только на дизайн, архитектурный долг upload останется
  раздражающим. Если весь день потратить только на upload, не будет видимого
  портфолио-результата.

## Следующий Инженерный Шаг

Следующий инженерный шаг: разобрать upload feature и сделать ее понятнее.

Параллельно зафиксирован визуальный ориентир для первого экрана:

- Итоговый reference image:
  `design-concepts/tapir-travel-first-screen/32-final-road-journal-mobile-dropdown.png`.
- Направление: темный личный дорожный журнал на столе, с ощущением архива
  путешественника, новым простым тапиром, компактным mobile hero, dropdown выбора
  страны на mobile и видимым началом ленты записей.
- Это пока дизайн-референс, а не реализованная верстка. К нему стоит двигаться
  отдельным UI-polish этапом, не смешивая с upload refactor.

Почему именно upload:

- Upload уже работает, но `frontend/src/features/upload/ui/cloudinary-upload-button.tsx`
  делает слишком много для UI-компонента.
- Там смешаны UI, auth check, URL context, Cloudinary config, загрузка external
  script, создание widget, upload callback, `createPost` и TanStack invalidation.
- Мы уже нашли реальные баги в этом flow, поэтому теперь хорошо понимаем, где
  границы ответственности.

Порядок работы:

1. Перечитать `CloudinaryUploadButton` и описать его ответственности прямо перед
   правкой.
2. Не менять поведение первым refactor-шагом.
3. Создать `frontend/src/features/upload/model/cloudinary-upload-types.ts`.
   Туда вынести типы Cloudinary widget/result, но не класть их в `shared`: это
   детали upload feature.
4. Создать `frontend/src/features/upload/model/cloudinary-upload.ts`.
   Туда вынести pure/helpers:
   - `pickMediaType`;
   - `buildUploadFolder`;
   - `parseCloudinaryUploadResult` или похожий guard/parser для `unknown` result.
5. Подключить helpers обратно в `CloudinaryUploadButton`.
6. Добавить простые unit tests на helpers:
   - image -> `PHOTO`;
   - video `.mov` -> `VIDEO`;
   - video `.mp3` -> `AUDIO`;
   - folder для `country/city`;
   - fallback folder без выбранного места;
   - parser возвращает info только для `event === "success"`.
7. Только после этого обсудить hook `useCloudinaryUpload`, куда могут переехать
   `busy`, `widgetRef`, `widgetFolderRef`, создание widget и `openUploadWidget`.
8. После каждого шага запускать проверки frontend.

Критерии готовности маленького refactor:

- Upload по-прежнему открывает Cloudinary widget.
- Фото и видео загружаются.
- После успешного upload feed/places обновляются без ручного refresh.
- При переходе между разделами upload идет в актуальный folder.
- Код стал проще читать, а не просто разъехался по большему числу файлов.
- Тесты покрывают хотя бы pure helpers, без попытки дергать настоящий Cloudinary
  widget через Playwright.

## Не делаем сейчас

- Не делаем `move post location` как полноценную admin-фичу. Для редких ошибок
  проще удалить/перезалить post или вручную поправить строку в базе.
- Не переписываем весь API layer за один заход.
- Не дробим `Feed` дальше ради числа строк.
- Не переносим backend с Render, пока понятно, что долгий первый request связан
  с free cold start и это терпимо для личного проекта.
- Не трогаем auth/security до отдельного этапа.

## Выбранное Визуальное Направление

Финальный reference:

- `design-concepts/tapir-travel-first-screen/32-final-road-journal-mobile-dropdown.png`

Суть направления:

- темный личный журнал дороги / archive desk / road journal;
- не SaaS, не туристический лендинг, не яркая открытка;
- центральный образ: раскрытый кожаный журнал на темном столе;
- внутри журнала: страна/город, год, карта/маршрут, фото, счетчики фото/видео;
- desktop: слева страны как главы журнала, справа/центр journal hero и записи;
- mobile: компактный hero, страна выбирается dropdown/bottom sheet, города остаются chips;
- посты на mobile лучше широкими карточками с фото/видео на всю ширину, но небольшой
  высоты, с затемнением и meta-info поверх.

Ассеты:

- `design-concepts/tapir-travel-first-screen/assets/main-journal-indonesia-bali.png`
- `design-concepts/tapir-travel-first-screen/assets/bg-desk-dark.png`
- `design-concepts/tapir-travel-first-screen/assets/country-china.png`
- `design-concepts/tapir-travel-first-screen/assets/country-egypt.png`
- `design-concepts/tapir-travel-first-screen/assets/country-indonesia.png`
- `design-concepts/tapir-travel-first-screen/assets/country-thailand.png`
- Bright variants лежат рядом и могут быть удалены позже, если не понадобятся.

Не использовать:

- красные точки выбора;
- лишний компас в описании;
- слишком желтую бумагу;
- паспортные/официальные штампы;
- координаты;
- neon/cyberpunk.

Практичный план:

1. Закоммитить design assets как reference material.
2. Перенести только выбранные production assets в `frontend/public` или оставить
   концепты в `design-concepts`, если пока работаем только по reference.
3. Сначала обновить `FeedHero`, не трогая feed orchestration.
4. Потом проверить desktop/mobile.
5. Только после hero решить, нужны ли изменения sidebar/mobile navigation.

## Недавно сделано

### Loading feedback и mobile navigation

Коммиты:

- `bfe6397` — `Improve feed loading feedback`
- `c27d910` — `Update country icons`

Что сделано:

- Добавлен отдельный loading notice для server data.
- На mobile chapters заменены с горизонтального scroll на grid по 3 элемента.
- Добавлены skeleton cards для mobile chapters во время загрузки places.
- Страновые иконки вынесены в `displayCountryIcon`.
- Иконки заменены:
  - China: `⛩️`
  - Egypt: `𓂀`
  - Indonesia/Bali: `🌋`
  - Thailand: `🐘`

Файлы:

- `frontend/src/features/feed/ui/feed-server-loading-notice.tsx`
- `frontend/src/features/feed/ui/mobile-chapters.tsx`
- `frontend/src/features/feed/model/mobile-chapters.ts`
- `frontend/src/features/places/model/place-labels.ts`
- `frontend/src/features/places/ui/places-sidebar.tsx`

### Upload fixes

Коммиты:

- `4856fa0` — `Fix Cloudinary upload signature`
- `175f45f` — `Refresh feed after upload`

Что сделано:

- Исправлена Cloudinary upload signature.
- Backend теперь подписывает `timestamp`, который присылает Cloudinary widget, а
  не генерирует новый timestamp.
- После успешного `createPost` frontend инвалидирует `posts` и `places`.
- Новая карточка появляется без ручного refresh.
- Upload button остается busy до фактического открытия Cloudinary widget, а не
  сбрасывается сразу после `widget.open()`.
- Cloudinary widget пересоздается при смене `folder`, чтобы upload не улетал в
  старый раздел после навигации.

Файлы:

- `backend/src/cloudinary/cloudinary.service.ts`
- `frontend/src/features/upload/ui/cloudinary-upload-button.tsx`
- `frontend/src/shared/api/api.ts`

Что поняли:

- Cloudinary widget присылает `paramsToSign`.
- Backend должен подписывать ровно эти параметры.
- Если backend подменяет `timestamp`, Cloudinary проверяет одну строку, а backend
  подписывает другую. Результат: `Invalid Signature`.

### Feed и FeedPostCard refactor

Коммиты:

- `a72ab0f` — `Extract post media preview`
- `0a8508a` — `Extract post like toggle hook`
- `ff2bca5` — `Extract post like hook and simplify feed hero`

Что сделано:

- `FeedHero` вынесен в отдельный UI-компонент.
- `MobileChapters` вынесен в отдельный UI-компонент.
- `CitySelection` вынесен в отдельный UI-компонент.
- `FeedEmptyState` удален как мертвый компонент.
- `POSTS_PAGE_LIMIT` получил явное имя.
- `buildPostsCountryCityFilter` вынесен в model.
- Derived selection state вынесен в `useFeedSelectionState`.
- Expanded modal behavior вынесен в `useExpandedPostModal`.
- Comments opening state/refs/callback вынесены в `useOpenFeedComments`.
- Media preview из `FeedPostCard` вынесен в `PostMediaPreview`.
- Like orchestration вынесена в `usePostLikeToggle`.
- В `FeedPostCard` осталось UI click plumbing: `preventDefault` и
  `stopPropagation`.

Вывод:

- `Feed` теперь лучше читать как orchestrator.
- `FeedPostCard` стал меньше, но props все еще стоит держать под наблюдением.
- Дальше дробить UI стоит только по смысловым границам, не ради числа строк.

### Comments delete modal

Что сделано:

- Delete confirmation modal для комментария вынесен через
  `createPortal(..., document.body)`.
- Overlay больше не зависит от `overflow-hidden`, transforms и stacking context
  карточки.
- Удаление комментариев проверено руками.

Оставлено на потом:

- Закрытие по `Escape`.
- Focus management.
- Scroll lock для background.
- Поведение `Escape`, если пользователь сейчас печатает комментарий.

### Places/posts backend contract

Коммит:

- `026ec8f` — `Support country-level place navigation`

Что сделано:

- `/places` возвращает навигационный индекс стран и городов.
- `unknown` убран из нормальной модели навигации.
- Country-level destinations выражаются явно: страна есть, городов нет.
- `Indonesia / Bali` больше не special case.
- `Thailand` показывает выбор `Bangkok / Pattaya`, а не смешанную ленту.
- `/posts?country=...&city=...` возвращает конкретную city-level ленту.

Контракт:

- `cities.length === 0` — country-level destination.
- `cities.length === 1` — direct city feed.
- `cities.length > 1` — нужен экран выбора города.
- Посты без `country` могут быть видны в `all`, но не становятся отдельным
  разделом навигации.

## Текущее понимание данных

### Upload

Цепочка:

`frontend -> backend config/signature -> Cloudinary widget -> createPost -> database -> TanStack invalidation -> frontend`

Факты:

- Cloudinary хранит файлы.
- Database хранит post record: `country`, `city`, `folder`, `media_url`,
  `cloudinary_public_id`, counters и остальную модель приложения.
- Frontend строит ленту из backend API.
- Папка Cloudinary не является источником правды для географии post.
- Ручной move/delete в Cloudinary не уведомляет backend.
- Если удалить asset только в Cloudinary, карточка может остаться в ленте,
  потому что запись в базе осталась.
- Если удалить post через frontend, backend удаляет запись из базы и пытается
  удалить asset из Cloudinary.

### Delete

Цепочка:

`frontend delete button -> backend DELETE /api/posts/:id -> Cloudinary destroy -> DELETE FROM posts -> invalidate posts/places`

Факты:

- Delete через приложение проверен: post исчезает из feed и asset исчезает из
  Cloudinary.
- Backend удаляет Cloudinary asset best-effort: если Cloudinary delete не
  сработал, запись из базы все равно удаляется.

### Sorting

Наблюдение:

- После upload видео может появиться ниже в ленте, если backend подтянул из
  Cloudinary metadata/EXIF дату съемки и обновил `created_at`.

Текущее решение:

- Это приемлемо для travel-журнала: сортировка ближе к дате кадра, а не к дате
  upload.
- Не трогаем, пока это не станет реальной UX-проблемой.

## Backlog по темам

### Upload feature

Следующие кандидаты:

- Разобрать `CloudinaryUploadButton`.
- Вынести pure helpers.
- Подумать про `useCloudinaryUpload`.
- Нормализовать root folder: сейчас username может дать `Tapir`, а старые папки
  могут лежать в `tapir`.
- Решить, нужен ли явный `cloudinaryRoot` вместо `auth.user.username`.
- Подумать, как upload должен вести себя в country-only destinations.

### API layer

Проблема:

- `frontend/src/shared/api/api.ts` содержит posts, likes, comments, auth,
  Cloudinary и upload-related requests в одном файле.

Кандидаты:

- Вынести общий `apiClient`: base URL, headers, `readApiError`.
- Разнести по доменам:
  - `auth-api`;
  - `posts-api`;
  - `places-api`;
  - `comments-api`;
  - `cloudinary-api`.
- Не делать это до upload refactor, чтобы не смешивать слишком много изменений.

### FSD boundaries

Проблема:

- Структура `app/features/entities/shared` уже есть, но границы пока мягкие.
- Есть imports между features, например feed использует labels из places.

Кандидаты:

- Сначала описать желаемые правила.
- Потом проверить imports.
- Общие place display helpers, возможно, перенести ближе к `entities/place` или
  `shared/lib/places`, если это станет повторяющейся зависимостью.

### Feed

Проблема:

- `Feed` все еще большой orchestrator.
- В нем остаются posts query, delete post, optimistic like cache update,
  infinite scroll и rendering states.

Кандидаты:

- Вынести posts query/cache helpers только если это уменьшит mental load.
- Подумать про `useFeedPosts`.
- Не дробить визуальные мелочи без выигрыша.

### FeedPostCard

Проблема:

- Props все еще довольно много.
- Внутри есть media, actions, comments slot, delete mode.

Кандидаты:

- `PostCardActions`, если actions станут сложнее.
- `PostCardMeta`, если place/text rendering начнет расти.
- Не выносить wrapper-компоненты, которые только прокидывают props.

### Comments

Кандидаты:

- Вынести `CommentsList`.
- Вынести `CommentForm`.
- Проверить, хорошее ли имя `onCommentAdded`, если callback вызывается и после
  delete.
- Backend: `DELETE /posts/:id/comments/:commentId` должен проверять пару
  `postId + commentId`, а не только `commentId`.

### Performance

Факты:

- Warm backend requests быстрые.
- Render Free может давать cold start.
- Loading feedback уже добавлен.

Команды для проверки cold start:

```bash
date
curl -sS -o /dev/null -w "places: %{time_total}s\n" https://travel-313c.onrender.com/places
curl -sS -o /dev/null -w "posts: %{time_total}s\n" "https://travel-313c.onrender.com/api/posts?limit=9&order=desc"
```

Правило проверки:

- Запускать до открытия сайта, Render dashboard или любых вкладок, которые могут
  разбудить backend.
- Если первый запрос занимает `20-60s`, а следующий сразу `0.1-1s`, это Render
  cold start.
- Если оба запроса быстрые, искать задержку в browser/network/rendering/cache.

### Accessibility/UI polish

Кандидаты:

- `Escape` для delete comment dialog.
- Focus management в modal/dialog.
- Проверка hover/focus states.
- Проверить Vercel Toolbar INP warning без dev overlays.

### Backend hygiene

Уже сделано:

- Backend `lint` больше не запускает `--fix`.
- Добавлен `lint:fix`.

Кандидаты:

- DTO и runtime validation.
- Tests на реальные flow.
- Auth hardening.
- Версионированные migrations.
- Разделение большого `CloudinaryService`.

Подробнее: `REVIEW_LEARNING_ROADMAP.md`.

## Команды проверки

Frontend:

```bash
cd /Users/tapir/Programming/travel/frontend
npx tsc --noEmit
npm run lint
npm run build
```

Backend:

```bash
cd /Users/tapir/Programming/travel/backend
npm run lint
npm run build
```

Git:

```bash
cd /Users/tapir/Programming/travel
git status --short
git diff --stat HEAD
git diff --check
```

## Как выбирать следующую задачу

Хорошая следующая задача должна:

- быть маленькой;
- иметь понятный пользовательский или инженерный эффект;
- не смешивать backend, frontend и архитектурный cleanup без необходимости;
- быть проверяемой руками и командами;
- учить одному конкретному навыку.

На сейчас лучший следующий шаг: refactor upload feature без изменения поведения.
