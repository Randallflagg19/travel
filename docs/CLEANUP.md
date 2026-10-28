# План уборки

Аудит 21–22 октября 2026. Код и дизайн-файлы не удалялись.

## Документы

В корне теперь один актуальный [ROADMAP](../ROADMAP.md) и [README](../README.md).
Все восемь прежних документов перенесены в [архив](archive/2026-10-21/README.md), включая пользовательские незакоммиченные правки. Побайтная сохранность проверяется по manifest.json.

FIRST_SCREEN_ROADMAP, PRE_RELEASE_REVIEW, REVIEW_LEARNING_ROADMAP, SOCIAL_MEDIA_PRESENCE и три VPS roadmap больше не нужны в корне. Их открытые задачи перенесены в новый роадмап, результаты сверки — в аудит. Старый ROADMAP тоже сохранён в архиве. После сохранения архива в Git его можно удалить из рабочего дерева отдельным коммитом; разумнее оставить как историю принятых решений и миграции.

## Design-концепты

Приложение не импортирует design-concepts; workflows упаковывают frontend/public, а не дизайн-архив. Уборка концептов экономит место в checkout, но не ускоряет страницу.

**Точные дубликаты, можно убрать после сохранения изменений в Git:**

- design-concepts/tapir-travel-first-screen/assets/bg-desk-dark.png
- design-concepts/tapir-travel-first-screen/assets/country-china-bright.png
- design-concepts/tapir-travel-first-screen/assets/country-egypt-bright.png
- design-concepts/tapir-travel-first-screen/assets/country-indonesia-bright.png
- design-concepts/tapir-travel-first-screen/assets/country-thailand-bright.png
- design-concepts/tapir-travel-first-screen/tapir-mascot-dark-bg.png
- design-concepts/tapir-social-preview-1200x630.jpg

Первые шесть побайтно совпадают с рабочими копиями в frontend/public/first-screen; JPEG совпадает с обоими файлами src/app/*-image.jpg. Всего 14 027 117 байт дубликатов. Новый незакоммиченный JPEG оставлен на месте.

**Уникальные материалы — сохранить или осознанно архивировать:** image.png, image copy.png, story bg.png, ad39dc60-8a41-4922-9a14-d0c216eab68c.jpeg, 5262575341794960657.jpg, 32-final-road-journal-mobile-dropdown.png. Отсутствие runtime-import не означает, что исходник больше не нужен дизайнеру. story-million.md — текстовый черновик, не мусор.

## Код и public

По графу статических imports от app routes недостижимы:

- frontend/src/features/feed/ui/post-comments-sheet.tsx
- frontend/src/shared/ui/sheet.tsx (используется только старым comments sheet).

После удаления проверить build/lint. Radix Dialog остаётся нужен редактору: удалять пакет вместе с sheet нельзя. cloudinaryOptimizedUrl не вызывается; можно удалить экспорт отдельно. useFeedPermissions — простой расчёт без React hooks, его переименование косметическое.

Не найдены ссылки из src на public/me.png (~4,79 МБ), public/tapir-travel.png (~1,89 МБ), next.svg/vercel.svg/file.svg/globe.svg/window.svg. Кандидаты на удаление после проверки внешних URL. Они не скачивались в замерах, поэтому их удаление не уменьшит текущие 4,3 МБ загрузки.

public/opengraph-image.png и public/twitter-image.png намеренно сохранены для старых опубликованных ссылок. Их не удалять только на основании отсутствия imports. Текущие src/app/opengraph-image.jpg и twitter-image.jpg нужны как файловые metadata routes, несмотря на одинаковое содержимое.

Рабочие first-screen PNG пока нужны приложению. Сначала заменить ссылки оптимизированными вариантами в PERF-01, затем решать судьбу исходников. Старые файлы в истории Git продолжат занимать место: переписывание истории ради этой уборки не требуется.
