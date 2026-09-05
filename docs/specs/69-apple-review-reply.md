# 69 · Ответ App Review на запрос «Guideline 2.1 — Information Needed» (заявка iOS 1.0)

Заведена 29.08.2026. Не код — консоль ASC и запись видео. Отправку (Reply + Resubmit) делает
Артём руками; сессия только заполняет.

## Что случилось

- 29.08 04:11 письмо «There's an issue with your Arcanum — обучение таро (iOS) submission»,
  заявка `485992cd-e723-4985-a141-db6aeec7fad9` (4 объекта, отправлена 28.08 22:51).
- ASC → App Review: версия 1.0 (1.0.0 (3)) — **Rejected, «2.1.0 Performance: App Completeness»**;
  подписки `premium.month`/`premium.year` и группа `Premium` — «Ready for Review» (не отклонены,
  ждут версию). Пересборка не нужна: сборка 3 остаётся в заявке.
- Сообщение Apple 29.08 04:10 — **«Guideline 2.1 — Information Needed — New App Submission»**:
  это не отказ по существу, а запрос восьми пунктов информации; ревьюер до функций не дошёл.
  Текст сообщения — в треде заявки (App Review → Yesterday at 10:51 PM → Messages).

Восемь пунктов Apple: (1) запись экрана с физического устройства на последней iOS — запуск,
типичный путь, покупки с информацией о подписке, системные запросы разрешений; (2) устройства и
ОС тестирования; (3) функции, аудитория, проблема и ценность; (4) как добраться до главных
функций, логины; (5) внешние сервисы; (6) региональные различия; (7) регулируемая отрасль /
чужие материалы; (8) что покупается через IAP и как дойти до покупки. И просьба положить это же
в Notes для будущих заявок.

## Сделано 29.08 (сессия, без отправки)

- **Primary Language → English (U.S.)** (App Information → General Information, «Saved»).
  Решение Артёма 29.08: основной язык — фолбэк витрины для всех стран без своей локализации;
  с русским основным немец или японец видели бы кириллицу. Русская, испанская, португальская
  локализации остались как были. Применяется со следующей отправкой версии (этой). Шапка ASC
  ещё показывает русское имя — обновится с версией. Проверено до смены: en-локализация версии
  1.0 полная (7 кадров, промо, описание, ключевые), у обеих подписок и у группы `Premium` —
  4 локализации, включая English (U.S.) (у группы: display name `Arcanum Premium`, app name
  `Arcanum — Learn Tarot`).
- **Notes версии 1.0 переписаны под 8 пунктов** и сохранены (3933 символа при лимите 4000 —
  лимит по счётчику поля; первая редакция была 4625 и не влезала). Единственный источник текста —
  `docs/store-listing.md`, раздел «Заметки для ревьюера»; править там → копировать в ASC.
- «Sign-in required» снят, контакт (`+995 591987596`, `arcanum.tarot@icloud.com`) заполнен —
  было. Поле Attachment пустое — видео приложить в тред (см. ниже), при желании и сюда.

## Сверка с документацией Apple 29.08 (вторая проверка по просьбе Артёма)

Источники: App Review Guidelines 2.1 / 3.1.2 (`developer.apple.com/app-store/review/guidelines/`),
страница подписок (`developer.apple.com/app-store/subscriptions/`), «Prepare for App Review»
(`developer.apple.com/distribute/app-review/`).

- **Найдено и исправлено: ссылок на Terms of Use не было в метаданных витрины.** Страница
  подписок Apple прямо требует: «your app and App Store metadata must include links to your
  Terms of Use and Privacy Policy». Политика в метаданных есть (App Privacy → Privacy Policy URL),
  условия — только в приложении (пейвол) и в «О приложении»; License Agreement в ASC —
  стандартная EULA Apple, описание ссылок не содержало. Классическая формулировка отказа 3.1.2
  («metadata does not include a functional link to the Terms of Use»). **Сделано**: в конец
  полного описания на четырёх языках добавлены две строки — «Условия использования: …/terms.html»
  и «Политика конфиденциальности: …/privacy.html» (`store-listing.md` → ASC, все четыре локали
  сохранены; `storeListing.test.ts` 122/122).
- 2.1(a) — метаданные полные, URL живые (сайт GitHub Pages), логина нет → демо-аккаунт не нужен ✓.
- 2.1(b) — покупки видны ревьюеру: пейвол показывает оба продукта ценами магазина (RevenueCat
  offering `default`), подписки в заявке «Ready for Review» ✓.
- 3.1.2(c) / страница подписок — на экране подписки: название и срок ✓, полная цена продления
  заметно ✓ (год — общей суммой), «Restore Purchases» ✓, ссылки условий и политики ✓, строка
  об автопродлении и отмене за 24 часа ✓ (`paywall.legal`).
- 2.3.3 скриншоты — реальное приложение ✓; 2.3.10 — описания и ключевые слова без упоминания
  других платформ ✓ (проверено грепом `Android|Google` по описаниям).
- App Privacy: User ID + Purchase History, «не связаны с пользователем», App Functionality
  (+ Analytics у покупок) — совпадает с тем, что собирает RevenueCat ✓.
- Purpose strings (5.1.1): единственное разрешение — уведомления, purpose string ему не нужен ✓.
- «Prepare for App Review»: видео Apple советует, когда функции трудно воспроизвести, — то есть
  видео и восемь пунктов НЕ из гайдлайнов, а из практики ревью для первой заявки нового
  аккаунта. Урок записан в `release-checklist.md` «Запуск».
### Третий проход (полный, по просьбе Артёма) — гайдлайны по разделам + ASC

- **4.3(b) Spam — «fortune telling»**: Apple прямо пишет, что новые приложения для гадания
  не принимает, «unless they offer a meaningfully different or improved experience». Для таро
  это главный риск после 2.1. Защита: категория Education, описание «не гадальный автомат, а
  курс»; в Notes пункт 3 усилен — «Arcanum is a learning app, not a fortune-telling app»,
  названы отличия (32-урочный курс с тестами, SRS-тренажёр, астрономический лунный календарь,
  офлайн). Notes 3944/4000, ASC обновлён.
- **2.3.1 скрытые функции / 3.1.1 обход покупки**: DEV-тумблер Premium и DEV-строки настроек
  завёрнуты в `__DEV__` (`app/settings.tsx:438`, `useDevMoonNow.ts`, `index.tsx:213`) — в
  production-сборке их нет ✓. Право даёт только магазин (`premiumSources` контракт) ✓.
- 1.1 / 1.4.1: блок «здоровье» у карт без диагнозов (страж `check_canon` «медицина в health»),
  дисклеймер в онбординге/About/описании ✓. 4.2 minimum functionality ✓ (курс, справочник,
  тренажёр — не «репак сайта»). 4.5.4 пуши не обязательны, opt-in до системного запроса ✓.
- 5.1.1(i) политика: что собирается, RevenueCat как третья сторона, хранение и удаление
  (`privacy.html`, 16 упоминаний RevenueCat, раздел deletion задачи 67) ✓; 5.1.1(ii)–(iv):
  имя/дата рождения опциональны и не покидают устройство ✓; 5.1.1(v) аккаунта нет ✓;
  5.1.2 передача данных только RevenueCat для покупок, ATT не нужен ✓.
- 2.3.7/2.3.8: ключевые слова `rider,waite` — «Rider-Waite» зарегистрирован U.S. Games как
  товарный знак колод; употребление описательное (общепринятое имя PD-колоды 1909 г.), риск
  низкий, оставлено. 2.3.12 «Что нового» для 1.0 не требуется.
- ASC: Content Rights «есть права» ✓ (public domain), License Agreement стандартная ✓, Age
  Rating 13+ (12+ Вьетнам/Корея) ✓, Export compliance флагом ✓, **DSA — «identified itself as
  a trader»** ✓, App Store Server Notifications production+sandbox → RevenueCat ✓, Pricing —
  бесплатно, 175 стран ✓, распространение Public ✓, Sign-in не требуется ✓, контакт ✓,
  App Privacy опубликована и совпадает с RevenueCat ✓, Name 21/30 и Subtitle 30/30 en ✓,
  у подписок кадр + заметка ревью ✓. Необязательное не заполнено (App Accessibility labels,
  Attachment, Apple Silicon/Vision Pro, Family Sharing) — не мешает.
- SDK/загрузка: сборка 3 принята ASC и ушла в ревью — значит, требования к SDK (Xcode 26),
  privacy manifest (ITMS-91053) и purpose strings при загрузке претензий не вызвали.
- **Известный риск, оставлен**: строка пейвола `paywall.legal` в приложении упоминает
  «App Store или Google Play» — 2.3.10 запрещает чужие платформы в приложении и метаданных.
  Чинить — только новой сборкой; Apple этого не назвал, оставить до 1.0.1 (в i18n сделать
  строку платформо-зависимой).

### Сборка для видео — решено 29.08: ad hoc `a320c6dd`

TestFlight не сработал: группа `Internal` (тестер `morfiy0393@gmail.com`, сборка 3 → «Testing»)
создана, но письмо не пришло и в TestFlight на iPhone под тем же Apple ID приложение не появилось
(статус тестера «No Builds Available», кнопки «Resend Invite» у внутренних тестеров нет).
Решение Артёма — запасной вариант: ad hoc `preview` `a320c6dd-33a7-42c3-96c2-12e00d5ab178`
(28.08, с ключом RevenueCat), страница `https://expo.dev/accounts/art9/projects/arcanum/builds/<id>`
→ «Install» в Safari; покупка — Sandbox-тестером. В Notes пункт 2 — только «ad hoc distribution»
(«and TestFlight» убрано, факт должен совпадать с видео). Разобраться с TestFlight — к закрытой
бете (release-checklist «Запуск»), не сейчас.

## Что осталось Артёму (по порядку)

1. Записать видео по сценарию ниже (файл `.mp4`/`.mov`, 3–6 минут).
2. ASC → App Review → заявка → «Reply to App Review»: вставить текст ответа (ниже), приложить
   видео (скрепка в поле ответа), отправить. Если файл не грузится по размеру — выложить в
   iCloud Drive / Google Drive с открытой ссылкой и вписать ссылку в ответ.
3. Там же — «Resubmit to App Review». Подписки и группа поедут автоматически (они в заявке).
4. Ждать письмо. После «Ready for Distribution» — релиз руками (тип релиза «вручную»).

## Текст ответа в тред (en)

Тело = восемь пунктов из `store-listing.md` («Заметки для ревьюера») целиком, обёрнутые так:

```
Hello,

Thank you for reviewing Arcanum. The requested information is below; the same text is now in the
App Review Information notes of version 1.0. The screen recording is attached to this message.

<восемь пунктов из store-listing.md, начиная с «Arcanum is an offline tarot learning app…»
и до «Contact: arcanum.tarot@icloud.com.»>

Best regards,
Artsiom Siviankov
```

⚠️ Если видео записано с ad hoc-сборки, а не из TestFlight, — в пункте 2 убрать «and TestFlight»
(и в Notes, и в ответе): факт должен совпадать с тем, что на видео.

## Сценарий видео (RU)

### С какой сборки писать

Рекомендуется **TestFlight, сборка 1.0.0 (3)** — ровно тот бинарник, что в заявке. Разовая
настройка: ASC → TestFlight → Internal Testing → «+» → имя группы (например `Internal`) → Add
Testers → Artsiom (Account Holder, уже пользователь ASC) → сборка 3 появится в группе сама
(флаг шифрования стоит в `app.json`, вопроса о compliance не будет) → на iPhone поставить
TestFlight из App Store → принять приглашение (письмо / Redeem) → Install. Покупки в TestFlight
идут в Sandbox без списания под ВАШИМ Apple ID — Sandbox-тестер не обязателен, но если он
залогинен в Настройки → Разработчик → Sandbox Apple Account, лист покупки покажет его.

Запасной вариант — ad hoc `preview` `a320c6dd` (стоит с 28.08, ключ RevenueCat в ней есть).
Тогда покупка — только через Sandbox-тестера (креды в `Documents\keys\apple-sandbox-tester.txt`).

### Подготовка (до записи)

1. iOS обновить до текущей: Настройки → Основные → Обновление ПО (Apple просит «latest OS»).
2. Язык телефона — английский на время записи: Настройки → Основные → Язык и регион → English
   первым. Онбординг и весь интерфейс приложения тогда будут на английском — ревьюеру понятнее.
   После записи вернуть русский.
3. Приложение УДАЛИТЬ и поставить заново (запись обязана начинаться с первого запуска и
   онбординга). Ставить с TestFlight (или ad hoc) — см. выше.
4. Прошлые тестовые подписки в Sandbox уже истекли (год = 1 час, до 6 продлений; куплена
   28.08 днём). Если после установки приложение всё же покажет «Premium активна» (право
   подтягивается само при старте) — очистить историю покупок тестера: ASC → Users and Access →
   Sandbox → Testers → тестер → «Clear Purchase History», затем удалить/поставить приложение снова.
5. Не беспокоить, яркость выше, портрет. Запись экрана: если кнопки нет в Пункте управления —
   Настройки → Пункт управления → добавить «Запись экрана». Микрофон не нужен (долгое нажатие на
   кнопку записи → микрофон выкл.).

### Запись (порядок и куда заходить)

Старт: Пункт управления → «Запись экрана» (отсчёт 3 с) → вернуться на рабочий стол → **тап по
иконке Arcanum** — запуск должен быть на видео.

1. **Онбординг**: шаг 1 — эмблема и дисклеймер (задержаться 2–3 с, чтобы текст читался) →
   Continue; шаг 2 — имя и дата рождения (заполнить или пропустить) → далее; шаг 3 — карта →
   Start.
2. **Today**: тап по карте дня → диалог про напоминания → «Allow» → **системный запрос
   уведомлений → Allow** (единственный системный промт в приложении — Apple просит его показать).
   Прокрутить толкование карты до вопроса дня.
3. **Course**: модуль 1 → урок 1 → пролистать теорию → тест: ответить на 5 вопросов → экран
   итога → назад.
4. **Замок → пейвол**: на вкладке Course прокрутить до модуля 3 (замок) → тап → открывается
   пейвол. **Задержаться 4–5 с**: видны оба плана с названием, сроком и ценой, бейдж скидки,
   внизу ссылки Terms of Use и Privacy Policy. Тапнуть Terms of Use (откроется встроенный
   браузер) → закрыть; то же с Privacy Policy → закрыть.
5. **Покупка**: выбрать Monthly → кнопка оформления → системный лист Apple (в TestFlight —
   с пометкой Sandbox, «You will not be charged») → подтвердить (Face ID / пароль) → «You're all
   set» → пейвол показывает «Monthly subscription · Renews <сегодня>» и чип ACTIVE. Дата = сегодня
   — не дефект, Sandbox сжимает месяц до 5 минут; это уже объяснено в ответе Apple.
6. **Открытый контент**: назад → Course → модуль 3 открылся → зайти в урок → назад.
7. **Settings**: Profile → Settings → строка «Arcanum Premium · Active» → тап → пейвол в активном
   состоянии → «Manage subscription» (откроется системный лист подписок App Store) → закрыть →
   тап «Restore Purchases» (при активном праве молчит — это норма, ответ Apple это не обещает
   показывать; тап на видео всё равно полезен).
8. **Cards**: справочник → открыть любую карту → пролистать разделы (значение, перевёрнутая,
   сферы, символика) → назад.
9. **Spreads**: Three Cards → вытянуть → открыть карты → толкование → сохранить в дневник.
   Затем открыть любой платный расклад (теперь доступен) — показать, что замка нет.
10. **Flashcards**: Course → карточка «Review» сверху → пройти 3–4 карты.
11. **Moon**: Today → строка луны → лунный календарь → назад.
12. **Profile**: журнал/статистика; About → видны ссылки и дисклеймер.

Стоп: тап по красному индикатору в статус-баре → Stop. Видео — в «Фото». Итого 3–6 минут;
если длиннее — можно не резать, Apple не ограничивает.

### Про отмену подписки — надо ли показывать и почему «не сразу»

Apple в этом запросе отмену **не просит**: пункт про покупки — «доступ к платному контенту,
поток покупки, информация о подписке». Показывать отмену на видео не нужно; достаточно
«Manage subscription» → системный лист (шаг 7).

То, что 28.08 после отмены подписка «не отписалась сразу», — **правильное поведение Apple, а не
дефект**: отменённая подписка действует до конца оплаченного периода, а в приложении меняется
только подпись — «Renews <дата>» → **«Valid until <дата>»** («Действует до …»). На лайве 28.08
подпись не сменилась, потому что URL App Store Server Notifications подключили через 3 минуты
ПОСЛЕ отмены (RevenueCat её не получил) — с 28.08 16:00 уведомления подключены, и на следующей
покупке ветка сработает. Плюс SDK держит кэш статуса ~5 минут.

Если всё же захочется записать отдельным коротким роликом (необязательно): после шага 7 —
Настройки iPhone → Разработчик → Sandbox Apple Account → Manage → подписка Arcanum Premium →
Cancel → подождать **5+ минут** → закрыть приложение из переключателя и открыть заново →
Settings → Arcanum Premium: строка «Valid until <дата>» вместо «Renews». Ещё через ~30 минут
(6 продлений по 5 минут не будет — отменена) право истечёт и пейвол снова покажет тарифы.
В основное видео это не класть: ожидание 5 минут и риск, что кэш ещё не обновился.

## Критерии «готово»

- [x] Primary Language = English (U.S.), сохранено без предупреждений (29.08).
- [x] Notes версии 1.0 = текст из `store-listing.md`, ≤ 4000 символов, сохранено, после
      перезагрузки страницы на месте (29.08, 3933).
- [x] Видео записано по сценарию (Артём, 29.08, iPhone, ad hoc `a320c6dd`): 6:56, 1290×2796
      HEVC 60 fps, 720 МБ. Проверено сессией по кадрам (ffmpeg, 1 кадр / 2 с, контакт-листы 5×4):
      запуск с рабочего стола, онбординг с дисклеймером, системный запрос уведомлений на 0:41,
      уроки с тестами, замок → пейвол (оба плана, цены, Terms · Privacy открыты), покупка
      Monthly в Sandbox → «You're all set» → «✦ ACTIVE · Renews August 29, 2026», Manage
      subscription → системный лист, платные расклады Horseshoe и Full Moon, тренажёр, справочник,
      лунный календарь, профиль, About + страницы сайта. Для вложения перекодировано в
      `arcanum-review.mp4` (H.264 1080×2340, 30 fps, без звука, 81 МБ).
- [x] Reply отправлен 29.08 16:37 с видео (текст 3996/4000 — у поля ответа тот же лимит 4000,
      вводная фраза Notes опущена); Артём нажал «Ответ», затем на странице версии
      **«Обновить данные для проверки»** и на странице заявки «Повторно отправить» → версия 1.0
      **«Ожидание проверки»**, заявка из 4 объектов в очереди (~16:42).
- [x] Ресабмит 05.09 ~14:04: «Update Review» (версия Rejected → Ready for Review) и «Resubmit to App
      Review» нажаты сессией по прямому указанию Артёма («нажми кнопки сам») — заявка из 4 объектов
      снова **«Waiting for Review»**, сборка 1.0.0 (3), подтверждающих модалок ASC не показал.
- [ ] Вердикт Apple → релиз руками → `release-checklist.md` «Запуск», changelog, CLAUDE.md.
      Отказ тем же шаблоном 4.3(b) → апелляция в App Review Board (текст 01.09 + факт второго отказа).

## Грабли отправки 29.08 (кратко; уроки — lessons.md)

- Лимит поля ответа в треде — 4000 символов, как у Notes; счётчик под полем.
- Вложение в тред грузится браузером; расширение Chrome (`file_upload`) берёт ≤ 10 МБ и только
  «расшаренные» файлы — 81 МБ приложен через Playwright MCP, который принимает пути только
  внутри репозитория: файл копировался в `.playwright-mcp/` (в `.gitignore`), после — удалён.
  Сессия ASC в Playwright отдельная — Артём логинился в его окне.
- После ответа «Повторно отправить» остаётся серой, пока на странице ВЕРСИИ не нажата
  «Обновить данные для проверки» — она возвращает отредактированный объект в заявку
  («Отклонено» → «Готово к проверке»), и только тогда заявку можно переотправить.
- TestFlight Internal-группа с тестером-владельцем аккаунта письмо не прислала и приложение в
  TestFlight под тем же Apple ID не показала (статус тестера «No Builds Available» при сборке
  «Testing»); «Resend Invite» у внутренних тестеров нет. Разобрать к закрытой бете.
- Видео 720 МБ HEVC → `ffmpeg -vf scale=1080:-2,fps=30 -c:v libx264 -crf 26 -an` → 81 МБ,
  7 минут кодирования; `drawtext` в ffmpeg на этой машине падает (fontconfig), таймкоды
  считать по позиции кадра в контакт-листе.

## 01.09 — отказ 4.3(b) Design: Spam и ответ-возражение

Вердикт по ресабмиту 29.08: **Rejected «4.3.0 Design: Spam»** (01.09 16:55, устройства ревью —
iPhone 17 Pro Max и iPad Air 11″ M3). Шаблон: «The app primarily features astrology, horoscopes,
palm reading, fortune telling or zodiac reports that duplicate the content and functionality of
similar apps… there are already enough of these apps on the App Store». Подписки и группа —
Ready for Review, отклонена только версия. «Next Steps» шаблонные (новое приложение / веб-апп) —
сам гайдлайн 4.3(b) допускает нишу при «meaningfully different or improved experience», на этом
и строится возражение.

**Стратегия (решение Артёма 01.09)**: сначала ответ в треде (та же команда ревью, 1–3 дня);
Resubmit той же сборки без ответа НЕ жать — риск автоповтора отказа. Подтвердят отказ →
формальная апелляция в App Review Board (ссылка «submit an appeal to the App Review Board» —
прямо в модалке Reply). Обе дороги аккаунту не вредят.

### Проверка фактов черновика (поиск + ASC живьём) — что сняли и почему

- «Duolingo-style progression» — убрано: в переписке с ревью чужой бренд не запрещён (2.3.7 — про
  метаданные витрины), но сравнение с чужим приложением подрывает тезис об уникальности.
- «Курсов таро в App Store нет» — НЕПРАВДА: Labyrinthos (уроки+квизы+энциклопедия; но EN-only,
  Entertainment, требует аккаунт и сеть), TarotLingo, Raka (90 уроков, AI-native),
  Learn Tarot: Rider Waite Cards, Tarot Flashcards: Rider-Waite (даже с SRS). Кандидаты и на
  ru/pt («Школа Таро: колода Тота», «Meu Tarot») — абсолют «no course in RU/PT» тоже снят,
  заменён на «four languages with full content parity — rare in this niche».
- Упор «символика по Уэйту 1911» — ОПАСЕН: чужие приложения (Tarot! от Fool's Dog, My Tarot Deck,
  Tarot Simple) вшивают public-domain-текст Уэйта целиком; перепаковка public domain — ровно
  паттерн 4.3(b). Аргумент развёрнут: «многие перепаковывают Уэйта — мы наоборот, ~950
  оригинальных текстов редактора, первоисточник только для сверки символики».
- «Nothing is AI-generated» — снято (es/pt переводились с ИИ-инструментами; вычитка носителем —
  задача 68). Заменено на правду: «в приложении нет ИИ-функций, тексты не из API и не по шаблонам».
- «Ничего не покидает устройство» — сужено до «прогресс и дневник» (RevenueCat передаёт статус
  подписки; согласовано с Notes п. 5 и App Privacy).
- «Написаны с нуля редактором» → «созданы для этого приложения его редактором» (канон ru/en — её,
  es/pt — локализации).
- Категория Education — подтверждена в ASC живьём (App Information → Primary Category = Education).

### Отправленный текст (01.09 19:01, 2565/4000, без вложений; Reply жал Артём)

```
Hello,

Thank you for the further review. We respectfully ask you to reconsider the 4.3(b) decision: we believe Arcanum does not match the group described in the rejection, and it offers the "meaningfully different or improved experience" that guideline 4.3(b) allows for.

1. Arcanum contains none of the features listed in the rejection. There is no astrology, no horoscopes, no palm reading and no zodiac reports anywhere in the app, and it does not tell fortunes: the App Store description says directly that it is "a course, not a fortune-telling machine", and our editorial rules forbid predictive claims - cards are always explained as symbols and prompts for reflection, never as predictions of the future.

2. Arcanum is an education app (its App Store category is Education). Its core is a structured course of 6 modules and 32 lessons with a short quiz after every lesson (160 questions in total), lesson-by-lesson progression and streaks; a spaced-repetition flashcard trainer (SM-2 algorithm) for memorizing the 78 cards; a complete reference of all 78 cards; a journal with evening reflection; and an astronomical moon calendar (new and full moon times are computed on the device with the Meeus algorithm - astronomy, not horoscopes).

3. Compared to the tarot apps already on the App Store, Arcanum is meaningfully different:
- Many apps in this niche simply repackage the public-domain text of A. E. Waite's "The Pictorial Key to the Tarot" (1911) as their card meanings. Arcanum does the opposite: its roughly 950 editorial texts are original, created for this app by its editor, a professional tarot practitioner - the historical source is used only to verify the symbolism descriptions.
- The app ships in four languages with full content parity: English, Russian, Spanish and Portuguese - rare in this niche, where learning apps are typically English-only. It has no AI features: card meanings and lessons are not pulled from an API or generated from templates.
- It combines in one offline app what elsewhere is split across several: the course, the 78-card reference, spaced-repetition flashcards, a journal with reflection, and spreads - with no account, no sign-up, no ads and no analytics; progress and the journal never leave the device, while the leading tarot-learning apps require an account and a connection.

We built Arcanum as a calm, private way to study tarot as a cultural and historical practice. A video walkthrough of the whole app was attached to our previous reply in this thread.

Thank you for your time and consideration.
```

Механика отправки: текст без вложений — расширение Chrome справляется (Playwright не нужен,
его сессия ASC протухла); поле Reply заполняется `form_input` одним вызовом (React принимает,
счётчик и кнопка оживают), «Reply» жмёт Артём. Дальше: ждать ответа в треде; если снова отказ —
App Review Board, аргументы те же + при необходимости убрать `divination` из ключевых слов en
и поставить кадр курса первым в наборе скриншотов (вторая линия, пока не трогаем).

## 05.09 — ресабмит той же сборки: Notes под 4.3(b), ключевые слова без «гадания»

**Проверка 05.09 (суббота)**: ответа Apple в треде нет — последнее сообщение наше, 01.09 19:01;
статус «Rejected / Unresolved Issues», подписки и группа — Ready for Review; в почте после
отказа 01.09 писем Apple нет (спам чист). Прошло три рабочих дня, 07.09 — День труда в США.
DSA-статус трейдера — всё ещё In Review с 27.08 (ревью не блокирует).

**Решение Артёма 05.09**: не ждать ответа в треде и не идти в App Review Board, а
**переотправить ту же сборку 1.0.0 (3)** с изменёнными метаданными. Почему это законно и чем
лучше треда: ресабмит ставит заявку в очередь, где ревьюер обязан вынести решение за 1–3 дня,
а на сообщение при статусе «Rejected» никто отвечать не обязан; 4.3(b) — вердикт о концепции,
новой сборки не требует; аккаунту одна повторная заявка не вредит (угрозы «спам» — про
десятки клонов, DPLA 3.2(f)). Апелляция остаётся в запасе: второй отказ с тем же шаблоном —
готовое досье для Review Board. Две дороги одновременно не открываем.

**Сделано сессией в ASC (сохранено, проверено после перезагрузки страницы):**
- **Notes версии переписаны** (3992/4000): первым абзацем — сжатое возражение по 4.3(b) из
  ответа 01.09 (нет астрологии/гороскопов/гадания; Education; ~950 оригинальных текстов против
  перепаковки Уэйта; паритет четырёх языков; всё в одном офлайн-приложении без аккаунта), дальше
  те же восемь пунктов запроса 2.1 короче. Ревьюер читает Notes, а не обязательно тред — до
  этого в Notes про 4.3(b) не было ни слова. Источник — `store-listing.md`, раздел «Заметки».
- **Ключевые слова без слов о гадании на всех четырёх языках** (`store-listing.md`,
  `storeListing.test.ts` 122/122): en `divination` → `lessons,quiz` (94/100); ru «гадание» →
  «уроки» (91); es `adivinacion,cartomancia` → `lecciones,simbolismo` (97 — было ровно 100);
  pt `adivinhacao` → `licoes` (90). Утверждать «not fortune telling» с «гаданием» в ключевых
  словах на трёх языках — противоречие, которое двуязычный ревьюер заметил бы.
- **Порядок скриншотов НЕ менялся**: перетаскивание в ASC (и на странице версии, и в Media
  Manager) не поддаётся автоматизации — мышиный drag, синтетические pointer/mouse-события и
  поиск React-обработчиков ничего не дали, у миниатюр `draggable=false`. Если хочется курс
  первым кадром — Артём перетаскивает руками в Media Manager (4 языка × одно движение), либо
  переливка набора Playwright'ом (файлы `docs/store/apple/<lang>/`, порядок = порядок выбора).
  Считается косметикой: ревьюер смотрит приложение, а не витрину.
- `paywall.legal` с упоминанием Google Play внутри iOS (2.3.10) требует новой сборки — отложено
  в 1.0.1, к 4.3(b) отношения не имеет.

**За Артёмом**: страница версии 1.0 → кнопка **«Update Review»** (возвращает версию в заявку:
Rejected → Ready for Review) → страница заявки → **«Resubmit to App Review»**. После этого статус
«Waiting for Review»; ответ ждать 1–3 рабочих дня (07.09 — праздник США). Отказ тем же шаблоном →
апелляция в App Review Board тем же текстом + факт второго отказа.

**Грабли автоматизации ASC 05.09** (уроки — lessons.md §12): `form_input` расширения Chrome
не меняет поле с кириллицей (репортует «set», значение остаётся прежним; латиница проходит) —
рабочий путь: клик в поле → `ctrl+a` → `type`; скриншот вкладки после Save/при открытии Media
Manager часто падает по таймауту CDP (страница тяжёлая) — состояние читать `get_page_text`/`find`
и зумом области, а не полным кадром; поле Notes и ключевые слова — на странице версии, локали
переключаются выпадашкой справа («English (U.S.)»), Notes — общие для всех локалей.

### Аудит перед ресабмитом (05.09, вторая проверка по просьбе Артёма)

Проверено живьём: версия 1.0 — сборка 1.0.0 (3) прикреплена, 4 локали × 7 кадров 6,9″, промо-текст,
описания (длины = `store-listing.md`: ru 2376 / en 2462 / es 2775 / pt 2606, ссылки Terms/Privacy на
месте), Support/Marketing URL, копирайт, «Sign-in required» выключен, контакт ревью заполнен, релиз
вручную; App Information — категория Education/Lifestyle, рейтинг 13+ (172 страны; Вьетнам/Корея 12+,
Бразилия A12), анкета возраста отвечена целиком (шаг 1 — 8 групп, Social Media = No, «новые вопросы»
из баннера закрыты), Content Rights «да», DSA трейдер указан, Primary Language en; App Privacy —
опубликована (Identifiers: User ID; Purchases — App Functionality + Analytics, «not linked»);
Pricing — 175 стран, Free; подписки — группа Premium (2), обе Ready for Review.

**Найдено и исправлено (без сборки, сохранено в ASC + `store-listing.md`, тест 122/122):**
- Описание на 4 языках утверждало «данные не собираются / no data collection», а опубликованный
  App Privacy декларирует Identifiers и Purchases — противоречие метаданных и privacy-лейбла
  (класс 2.3.1 / 5.1.1). Заменено на «без аккаунта, рекламы и слежки» (en «no ads, no tracking»,
  es «no hay publicidad ni rastreo», pt «não há anúncios nem rastreamento»); строка таблицы фактов
  переписана с объяснением, почему «без сбора данных» писать нельзя.
- Notes п. 5: «No analytics» → «No analytics SDK» (App Privacy у Purchases отмечает Analytics —
  это RevenueCat, а не SDK аналитики в приложении); 3996/4000.

**Остаточный риск, требующий НОВОЙ сборки (не делали, решение — 1.0.1):** строки `paywall.legal`,
`termsText`, `dataText`, `restoreNoneText` в `i18n.ts` на всех языках говорят «App Store или
Google Play» внутри iOS-сборки — 2.3.10 (упоминание другой платформы). Два ревьюера (2.1 и 4.3(b))
видели пейвол и не отметили; чинится платформенной подстановкой имени магазина + новая сборка
(buildNumber 4) + заливка Артёмом. К 4.3(b) отношения не имеет.
