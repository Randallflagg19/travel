# UI, первый экран и мобильные взаимодействия

Сверка кода: 2026-09-07. Первый этап [общего плана](ROADMAP.md).
Цель — законченный личный travel journal и предсказуемое взаимодействие на телефоне.

## Выполнено по коду

- `frontend/src/features/feed/ui/feed-hero.tsx` уже реализует раскрытый журнал:
  фон `/first-screen/journal-template-clean.png`, отдельное фото и текстовые слои.
  Задача «начать перенос reference в hero» устарела.
- `mobile-chapters.tsx` уже содержит native select страны, select сортировки,
  chips городов и skeleton. Историческая сетка стран по три элемента заменена.
- `feed-server-loading-notice.tsx` различает загрузку маршрута и кадров.
- `post-comments-block.tsx` рендерит подтверждение удаления через portal в body.
- `use-expanded-modal-behavior.ts` уже закрывает просмотр медиа по Escape
  и фиксирует body с восстановлением позиции прокрутки.

Это наличие реализации, а не утверждение, что все мобильные сценарии проверены.

## Запланировано: последовательность

### 1. Проверить и довести hero photo fit

Наблюдение со скрина 4 сентября: фото не полностью совпадало с бумажной рамкой.
По коду нельзя подтвердить визуальное исправление. Сейчас контейнер имеет
`aspect-[1672/941]`, слот фото — `left:54.62%`, `top:15.50%`,
`width:25.12%`, `height:49.10%`, изображение — `object-cover object-center`.

- Снять desktop/mobile скриншоты текущего UI.
- Сопоставить размеры исходного bitmap и прямоугольник photo slot;
  проверить object-fit/object-position и масштабирование.
- Исправлять геометрию, не накапливать случайные clip-path/rotate/offset подгонки.
- Готово, когда края фото совпадают с рамкой без зазоров и выступов
  на узком экране, desktop и при изменении масштаба.

### 2. Исправить initial «Все посты»

Причина всё ещё присутствует в коде:

- `MobileChapters`: `value={selectedCountry || "__all"}`.
- `useFeedParams`: `all` только при `searchParams.get("all") === "true"`.
- `useFeedSelectionState`: `canLoadPosts = all || selectedCity || isCountryFeed`.
- `Feed`: query включается только при `canLoadPosts && auth.hydrated`.

На `/` интерфейс показывает «Все посты», но posts query выключен. Повторный
выбор уже выбранного option может не вызвать onChange. Это отдельный UI/query
баг, не объяснение обрывов статических файлов из сетевого инцидента.

1. Выбрать единый контракт: `/` считается all-feed или канонизируется в `?all=true`.
2. Согласовать `use-feed-params.ts`, `mobile-chapters.tsx`,
   `use-feed-selection-state.ts`, `posts-query-params.ts` и отображение desktop.
3. Проверить `/`, `/?all=true`, refresh, back/forward,
   страна → город → «Все посты» и смену сортировки.

Готово: visual selection, URL, query key, фильтр API и показанные данные совпадают;
начальная загрузка работает без предварительного выбора страны.

### 3. Довести первый viewport и мобильный flow

- Проверить, видна ли навигация после компактного hero; читаются ли мелкие cqw-тексты.
- Уточнить личный текст и подсказку выбора главы без рекламного CTA.
- `Feed` передаёт hero только `title`: год `2026`, `450` фото, `9` видео,
  `/me.png` остаются defaults. Решить, какие данные должны быть реальными,
  и не выдавать декоративные значения за проверенные счётчики выбранного места.
- Проверить яркость фото, overlay, обрезку значимых деталей и карточки медиа.
- Пересмотреть фразу loading notice «После паузы это может занять больше времени»:
  прежнее объяснение через Render cold start больше не соответствует размещению backend.
- Проверить загрузку, пустую ленту, ошибку и повторную попытку.

### 4. Диалоги и touch-взаимодействия

- Для delete-comment dialog добавить/проверить Escape, управление и возврат фокуса,
  focus trap и scroll lock: portal сам по себе этого не реализует.
- Для expanded media проверить существующий Escape/scroll lock на телефоне,
  вложенные комментарии, ввод с клавиатуры и возврат на прежнее место в ленте.
- Проверить touch targets, hover/focus, открытие карточки, лайк и comments:
  нажатие action не должно случайно открывать/закрывать медиа.
- INP из Vercel Toolbar перепроверять на production без dev overlays;
  старое предупреждение не является текущим измерением.

## Визуальное направление и ассеты

Reference: [32-final-road-journal-mobile-dropdown.png](design-concepts/tapir-travel-first-screen/32-final-road-journal-mobile-dropdown.png).
Тёмный стол, кожаный журнал, страны как главы; desktop sidebar,
mobile dropdown и chips городов. Широкие невысокие мобильные карточки — ориентир,
окончательную композицию принимать по реальным фото/видео.

Production assets уже лежат в `frontend/public/first-screen/`: journal template,
фон стола, `sidebar/country-*-bright.png`, `sidebar/tapir-mascot-dark-bg.png`.
Концепты — в `design-concepts/tapir-travel-first-screen/assets/`.
Старые non-bright country assets и `main-journal-indonesia-bali.png` отсутствуют
в рабочем дереве; не ссылаться на них как на доступные production assets.

Не переносить все варианты и не копировать reference пиксель-в-пиксель.
Сохранить тёмную палитру и тапира; избегать красных точек выбора, лишнего компаса,
жёлтой бумаги, официальных штампов, координат и neon/cyberpunk.
Работать небольшими UI-изменениями без глобального архитектурного cleanup.

## Требует проверки и критерии завершения этапа

Свежая браузерная проверка в этой документальной сверке не выполнялась.
Нужны desktop и реальный телефон: initial load, all-feed, Thailand →
Bangkok/Pattaya, Indonesia/Bali, country-only, сортировка, фото/видео,
comments и диалоги. Проверить refresh и back/forward.

После будущих правок в `frontend`: `npx tsc --noEmit`, `npm run lint`,
`npm run build`, целевая регрессия all-feed. Не считать текущие smoke tests
достаточными для мобильного контракта.

Этап готов, когда фото помещается в рамку, текст и навигация читаемы,
выбор раздела соответствует данным, touch/actions и диалоги предсказуемы.
Далее — [рефакторинг](REVIEW_LEARNING_ROADMAP.md).
