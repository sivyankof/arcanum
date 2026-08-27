# Промт следующей сессии (после 28.08.2026, ночь)

> Артёму: открой новую сессию Claude Code в папке проекта и вставь текст ниже целиком
> (от «Контекст:» и до конца файла).

---

Контекст: сессия 27–28.08 закрыла всю сторону Apple: аккаунт активирован, Paid Apps
Agreement / банк / налоговые формы — Active, Bundle ID и приложение «Arcanum — обучение таро»
созданы, первая iOS `preview`-сборка (`23daec5d`) прошла лайв-проверку на iPhone Артёма
(«всё работает»), Apple-набор скриншотов витрины (63б, 28 кадров 1290×2796) снят и закоммичен,
`supportsTablet: false`. Подробности и грабли — `docs/release-checklist.md` п. 1 и раздел
«Сборка», статус — CLAUDE.md. Повторно не пересказывать; перед работой по своей теме прочитать.

## ⏰ Первым делом

1. Спроси Артёма про **утренний баннер лунного пуша 28.08** — там обязано быть «Полнолуние ✦»
   (отложенное подтверждение 47б, назначено 22.08). Ответ — в `docs/specs/47b-*.md` и changelog.
2. Спроси, пришло ли письмо Apple по **DSA** (трейдер, статус был «In Review») — результат
   запиши в release-checklist п. 1.

## Главная задача сессии — консольная часть 53б (пейвол «пока нельзя» → живые покупки)

Порядок по `docs/specs/53b-revenuecat.md`, раздел «Консоль» (строки ~60–95). Что нужно
от Артёма ДО начала (спросить сразу, одним сообщением):
- **цены** — спека предлагает **$4.99/мес и $35.99/год** (базовая валюта аккаунтов USD,
  скидка 39 % как у ориентира 399 ₽ / 2 890 ₽); утвердить или получить другие числа;
- **аккаунт RevenueCat** — регистрацию делает Артём сам (`app.revenuecat.com` → Sign up →
  проект `Arcanum`); после входа в Chrome настройка внутри — через браузерный MCP;
- подтверждение **«без вводных предложений/триала»** (решение 2 спеки 53б).

Дальше сессия делает сама через браузер (Chrome MCP; режим разрешений — ручной, см. ⚠️ ниже):
1. **App Store Connect** → приложение → Subscriptions: группа `Premium`, продукты
   `premium.year` / `premium.month` (autorenewable, локализации ru/en/es/pt — тексты
   подписки готовить по `docs/store-listing.md` и content-guide, лимиты Apple: display name 30,
   description 45), цены из решения Артёма, Review notes. Ссылки политики/условий — из `appInfo.ts`.
2. **Play Console** → Монетизация → Подписки: `premium` с базовыми планами `year` (P1Y) и
   `month` (P1M), цены USD, активировать; Лицензионное тестирование — аккаунт Артёма.
3. **RevenueCat**: платформы App Store (In-App Purchase Key `.p8` из ASC → Users and Access →
   Integrations → In-App Purchase) и Play Store (service-account JSON — по мастеру RevenueCat,
   Google Cloud → Play Console «Пользователи и разрешения»); entitlement `premium`;
   продукты `premium.year`/`premium.month` (Apple) и `premium:year`/`premium:month` (Google);
   offering `default` (current) с пакетами `$rc_annual` / `$rc_monthly`.
4. Ключи: `eas env:set --name EXPO_PUBLIC_RC_IOS_KEY --value appl_… --environment production
   --environment preview --visibility plaintext` и то же для `EXPO_PUBLIC_RC_ANDROID_KEY`
   (`goog_…`); локально `.env` по `.env.example`. Проверка доставки ключа в бандл — AGENTS.md.
5. Пересборка `preview` iOS и Android — сертификаты Apple уже в EAS, поэтому сборки идут
   `--non-interactive` из сессии: `npx eas-cli@latest build --platform ios --profile preview
   --non-interactive` (и `android`). Установка iOS — страница сборки → Install в Safari.
6. Лайв 6в покупок — сценарий в конце спеки 53б (Sandbox-тестер Apple: ASC → Users and Access
   → Sandbox → добавить тестовый Apple ID; Google — лицензионный тестер). После этого — анкета
   «Безопасность данных» Play Console и App Privacy в ASC переписываются (покупка = данные
   уходят наружу), чек-лист в release-checklist.

## Хвост 63б — заливка витрины в App Store Connect

После (или параллельно) продуктов: App Store Connect → 1.0 Prepare for Submission — тексты из
`docs/store-listing.md` (название уже стоит; подзаголовок 30, промо 170, описание 4000,
ключевые 100 — на 4 языках: ru основной + en-US, es-MX/es-ES, pt-BR), кадры
`docs/store/apple/<lang>/01–07.jpg` (порядок 01→07; загрузка — тем же приёмом, что в Play,
раздел «Заливка витрины: как прошла 26.08» release-checklist), URL поддержки/маркетинга/политики
из `appInfo.ts`, возрастной рейтинг (те же факты, что IARC: ожидаемо 12+), категория
Образование + Стиль жизни, App Privacy («данные не собираются» — до 53б; после — переписать).
На проверку НЕ отправлять — сабмит вместе с релизной сборкой после 53б.

## ⚠️ Грабли сессии 27–28.08 (чтобы не наступать заново)

- Классификатор auto-режима блокирует часть браузерных действий на сайтах Apple (навигация по
  URL, новые вкладки, `form_input`, клавиша Enter). Просить Артёма переключить сессию в ручной
  режим (Shift+Tab) ДО работы с консолями; выпадающие списки — стрелкой Down + скриншот.
- Ссылки, открывающие новую вкладку, уходят вне группы вкладок сессии — идти прямым URL.
- `eas device:create` и первая сборка с Apple login — только в отдельном PowerShell Артёма
  (`!` в сессии тоже без stdin). Дальнейшие сборки — `--non-interactive` из сессии.
- Финансовые формы (банк, W-8BEN) — вводит Артём; сессия открывает, читает, подсказывает.
  Формат полей банка Грузии и запертое гражданство W-8BEN записаны в release-checklist п. 1.
- Ad hoc-сборке на iOS 16+ нужен Режим разработчика на телефоне.

## Что ждёт не нас

- DSA Apple — «In Review», письмо.
- Закрытый тест Google — 12+ тестеров × 14 дней (группа `arcanum-testers@googlegroups.com`).
- Android-телефон Артём покупает.
