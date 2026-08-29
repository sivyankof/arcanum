# Тексты для магазинов приложений (задача 57)

Черновики к сабмиту. Когда аккаунты заведены — копировать отсюда, а не сочинять в форме под таймером.
Лимиты держит контракт-тест `src/lib/__tests__/storeListing.test.ts`: он парсит заголовки вида
`### <язык> · <поле> (<лимит>)` и падает, если блок длиннее лимита или содержит запрещённое слово.

**Статус вычитки.** `ru` и `en` — написаны сессией 23.08 по фактам из кода. `es` и `pt` —
**черновик, носитель не читал** (волна Cowork, как строки задачи 54). Редактор (жена) вычитывает
все четыре.

## Факты о приложении (проверено по коду 23.08 — не выдумывать новые)

| факт | источник |
|---|---|
| 78 карт (22 старших + 56 младших) | `content/cards.json` |
| 13 блоков значения на карту: общее, перевёрнутое, любовь, работа, финансы, здоровье, карта дня, символика, путь рождения + 4 перевёрнутых по сферам | `cards.json`, ключи `content` |
| курс: 6 модулей, 32 урока, 160 вопросов | `content/course.json` |
| 10 раскладов, из них 3 бесплатных | `content/spreads.json` |
| флеш-карты по алгоритму SM-2 | `src/lib/srs.ts` |
| лунный календарь: фазы, новолуние и полнолуние по алгоритму Меюса | `src/lib/moon.ts` |
| дневник карт дня с заметками и вечерней рефлексией | product-spec §5 |
| 4 языка интерфейса и контента: ru, en, es, pt | `src/lib/i18n.ts` |
| работает офлайн, без аккаунта и без сбора данных | master-plan §4, решение 22.08 |
| версия 1.0.0 | `app.json` |

⚠️ Чего в текстах быть НЕ должно (проверяет тест): обещаний предсказать будущее, гарантий,
медицинских и финансовых советов, слова «бесплатно» в заголовке (правило App Store),
названий конкурентов. Дисклеймер последней строкой описания — исключение: там эти слова
стоят С ОТРИЦАНИЕМ и обязательны по правилам Apple 1.4.1 (тест смотрит на отрицание
в том же предложении).

⚠️ **Ключевые слова iOS не повторяют слов из названия и подзаголовка** того же языка:
Apple индексирует название и подзаголовок и так, а дубль тратит лимит в 100 символов впустую.
Первая редакция черновика теряла так до четырёх слов из двенадцати — теперь это держит тест.
Вычитка es/pt носителем — `docs/prompts/57-store-native.md`.

✅ **Название утверждено Артёмом 23.08**: рамка «обучение таро» на всех четырёх языках
(варианты «курс таро» и «таро для начинающих» отклонены). Подзаголовок остаётся тем же.
Носитель может предложить свои формулировки es/pt внутри этой рамки (задача 57н).

---

## Категории и рейтинг (одинаково для всех языков)

- Категория: **Образование**; вторичная — Стиль жизни. Не «Развлечения»: обучение проходит ревью мягче.
- Возрастной рейтинг: iOS **12+**, Google — аналогично (эзотерическая тематика).
- Ответы на анкеты приватности: **данные не собираем**, аналитики в v1 нет. Наружу уходит только
  покупка подписки (чек и анонимный идентификатор установки в App Store / Google Play и RevenueCat) —
  декларировать как «Purchases / покупки, не связаны с личностью».

## Заметки для ревьюера (en, поле App Review Notes)

Версия 29.08 (задача 69): переписаны под восемь пунктов запроса App Review «Guideline 2.1 —
Information Needed» и залиты в ASC (3944 символа при лимите 4000; лимит — по счётчику поля,
`storeListing.test.ts` этот блок не парсит). Тот же текст — тело ответа в треде заявки
(`docs/specs/69-apple-review-reply.md`). Меняя факты (устройства, цены, что свободно), править
здесь, потом копировать в ASC.

```
Arcanum is an offline tarot learning app: a course, a 78-card reference, a daily card with a journal, spreads, flashcards and a moon calendar. No account or sign-up; nothing is sent to a server: progress, journal and settings live on the device only.

1. SCREEN RECORDING. Attached to the App Review thread (physical iPhone). It starts with launching the app and shows onboarding, the daily card, a lesson with its quiz, a locked module opening the paywall, the subscription purchase (plan title, duration, price, Terms of Use and Privacy Policy links), the unlocked content, Restore Purchases, the reference, spreads, flashcards and moon calendar. The only system prompt is the notification permission. The renewal date shown equals the purchase date because Sandbox compresses periods.

2. DEVICES TESTED. iPhone 14 Pro Max and iPhone 17 Pro Max, both on the latest public iOS release (iOS 26); builds installed via ad hoc distribution, purchases tested with a Sandbox tester account.

3. FUNCTIONS AND AUDIENCE. Arcanum is a learning app, not a fortune-telling app: a step-by-step course of 32 lessons in 6 modules with quizzes, all 78 cards (upright and reversed meanings, life areas, symbolism), a daily card with journal and reflection, 10 spreads with every position explained, spaced-repetition flashcards and a moon calendar computed astronomically. Audience: adults and teens (13+) learning tarot symbolism as a hobby or self-reflection practice. Problem solved: tarot resources are scattered; Arcanum gives a structured curriculum and a daily practice in one offline app. It is educational and entertainment content: it does not predict the future and gives no medical, legal or financial advice (disclaimer in onboarding and on About).

4. ACCESS. No login. First launch: 3-step onboarding (intro with disclaimer -> optional name and birth date -> first card) -> Today tab. Tabs: Today (daily card; a reminder dialog on the first daily card requests the notification permission), Course (modules 1-2 free), Cards (reference), Spreads, Profile (Settings, About). Moon calendar: the moon row on Today. Flashcards: the "Review" card at the top of the Course tab.

5. EXTERNAL SERVICES. Purchases: StoreKit through the RevenueCat SDK (subscription status only; the only network service the app uses). Notifications are local, scheduled on the device; no remote push server. Privacy policy, Terms of Use and support are static pages on GitHub Pages. No analytics, ads, authentication, AI or data providers.

6. REGIONAL DIFFERENCES. None: features and content are identical in every country. UI in English, Russian, Spanish and Portuguese (device language, switchable in Settings); prices are set per storefront.

7. REGULATED INDUSTRY / THIRD-PARTY MATERIAL. Not a regulated industry. Card images: the Rider-Waite-Smith deck (Pamela Colman Smith, 1909), public domain, scans from Wikimedia Commons. Some symbolism passages are based on A. E. Waite, "The Pictorial Key to the Tarot" (1911), public domain. All other text is original, written by the app's editor.

8. IN-APP PURCHASES. One auto-renewable subscription group "Arcanum Premium" with two plans: Premium - Yearly (premium.year, 1 year, USD 34.99) and Premium - Monthly (premium.month, 1 month, USD 5.99); no free trial or introductory offer. Premium unlocks course modules 3-6, the remaining 8 of 10 spreads and unlimited flashcard sessions. Free forever: daily card, the 78-card reference, journal, modules 1-2, the Three Cards and New Moon spreads, one flashcard session a day. Where to buy: Profile -> Settings -> "Arcanum Premium", or tap any locked module or spread. The paywall lists both plans with title, duration and store price, the Terms of Use and Privacy Policy links and "Restore Purchases". After purchase it shows the active plan and renewal date; "Manage subscription" opens the App Store subscription sheet.

Contact: arcanum.tarot@icloud.com.
```

Прежняя короткая версия (483 символа, до 29.08) — в истории git.

---

# Русский

### ru · название (30)
Arcanum — обучение таро

### ru · подзаголовок iOS (30)
Курс, значения карт, расклады

### ru · короткое описание Google (80)
Учитесь читать таро: курс из 32 уроков, 78 карт со значениями и карта дня

### ru · ключевые слова iOS (100)
гадание,расклад,колода,арканы,старшие,символика,луна,таролог,карта дня,уэйт,новичкам,интуиция

### ru · промо-текст iOS (170)
Новое в 1.0: курс из 32 уроков, справочник 78 карт, десять раскладов, тренажёр памяти и лунный календарь. Всё работает офлайн, без регистрации.

### ru · полное описание (4000)
Arcanum учит читать таро с нуля — спокойно, по 5 минут в день.

Не гадальный автомат, а курс: вы разбираетесь, откуда берутся значения карт, и постепенно начинаете читать их сами.

ЧТО ВНУТРИ

• Курс из 6 модулей и 32 уроков. Теория, разбор карт и короткий тест после каждого урока — 160 вопросов на весь курс. Следующий урок открывается после предыдущего, прогресс и серия дней помогают не бросить.

• Справочник всех 78 карт. У каждой — общее значение и перевёрнутое, разбор по сферам (любовь, работа, финансы, здоровье), символика рисунка и значение в роли карты дня. Поиск и фильтры по арканам и мастям.

• Карта дня. Одна карта каждое утро с толкованием и вопросом для закрепления, вечером — короткая рефлексия «отозвалось или нет». Всё сохраняется в дневник с заметками.

• Десять раскладов: три карты, кельтский крест, подкова, на отношения, на выбор, на месяц и другие. Позиции подписаны и объяснены — видно, что означает каждое место.

• Тренажёр памяти. Флеш-карты по алгоритму интервального повторения: приложение само решает, какую карту показать сегодня, чтобы значения запоминались надолго.

• Лунный календарь. Фазы, новолуния и полнолуния рассчитываются по астрономическому алгоритму, а не по приблизительной таблице. У новолуния и полнолуния — свои расклады.

• Дневник. Все карты дня и расклады с заметками, статистика месяца, экспорт и восстановление данных файлом.

КАК УСТРОЕНО

Приложение работает офлайн: весь контент лежит внутри, интернет нужен только для покупки подписки. Аккаунт не нужен, данные не собираются — прогресс и записи хранятся на вашем устройстве.

Четыре языка: русский, английский, испанский, португальский.

ПОДПИСКА ARCANUM PREMIUM

Бесплатно навсегда: карта дня с толкованием, полный справочник 78 карт со всеми разделами, дневник без ограничений, первые два модуля курса, расклады «Три карты» и «Новолуние», одна сессия тренажёра в день.

Premium открывает модули 3–6 курса, остальные расклады и тренажёр без ограничений. Подписка продлевается автоматически, отменить можно в настройках магазина. Если подписка закончилась, всё, что вы уже прошли, остаётся с вами.

Приложение создано для обучения и развлечения. Оно не предсказывает будущее и не заменяет консультацию специалиста.

Условия использования: https://sivyankof.github.io/arcanum/terms.html
Политика конфиденциальности: https://sivyankof.github.io/arcanum/privacy.html

### ru · что нового (4000)
Первая версия Arcanum.

Курс из 32 уроков, справочник всех 78 карт со значениями и символикой, карта дня с дневником и вечерней рефлексией, десять раскладов, тренажёр памяти и лунный календарь. Всё работает офлайн, на четырёх языках.

---

# English

### en · название (30)
Arcanum — Learn Tarot

### en · подзаголовок iOS (30)
Course, card meanings, spreads

### en · короткое описание Google (80)
Learn to read tarot: a 32-lesson course, all 78 cards explained, daily card

### en · ключевые слова iOS (100)
divination,deck,arcana,symbolism,moon,reading,daily,journal,flashcards,beginners,rider,waite

### en · промо-текст iOS (170)
New in 1.0: a 32-lesson course, all 78 cards explained, ten spreads, a memory trainer and a moon calendar. Everything works offline, no sign-up needed.

### en · полное описание (4000)
Arcanum teaches you to read tarot from scratch — calmly, five minutes a day.

It is a course, not a fortune-telling machine: you learn where card meanings come from and gradually start reading the cards yourself.

WHAT'S INSIDE

• A course of 6 modules and 32 lessons. Theory, card walkthroughs and a short quiz after every lesson — 160 questions in total. Each lesson unlocks the next one, and streaks keep you coming back.

• A reference of all 78 cards. Every card has its upright and reversed meaning, a breakdown by area of life (love, work, money, health), the symbolism of the drawing and what it means as a card of the day. Search and filters by arcana and suit.

• Card of the day. One card each morning with its reading and a question to make it stick; in the evening, a short reflection on whether it resonated. Everything is saved to your journal with notes.

• Ten spreads: three cards, Celtic cross, horseshoe, relationship, choice, month ahead and more. Every position is named and explained, so you can see what each place stands for.

• Memory trainer. Flashcards with spaced repetition: the app decides which card to show today so the meanings stay with you.

• Moon calendar. Phases, new moons and full moons are calculated with an astronomical algorithm rather than an approximate table. New and full moons come with their own spreads.

• Journal. Every daily card and spread with your notes, monthly statistics, export and restore from a file.

HOW IT WORKS

The app works offline: all content is bundled inside, and the internet is only needed to buy a subscription. No account, no data collection — your progress and notes stay on your device.

Four languages: English, Russian, Spanish and Portuguese.

ARCANUM PREMIUM

Free forever: the daily card with its reading, the complete 78-card reference with every section, an unlimited journal, the first two course modules, the Three Cards and New Moon spreads, and one trainer session a day.

Premium unlocks course modules 3-6, the remaining spreads and the trainer without limits. The subscription renews automatically and can be cancelled in your store settings. If it lapses, everything you have already completed stays with you.

This app is made for learning and entertainment. It does not predict the future and is not a substitute for professional advice.

Terms of Use: https://sivyankof.github.io/arcanum/terms.html
Privacy Policy: https://sivyankof.github.io/arcanum/privacy.html

### en · что нового (4000)
The first release of Arcanum.

A 32-lesson course, all 78 cards with meanings and symbolism, a daily card with journal and evening reflection, ten spreads, a memory trainer and a moon calendar. Everything works offline, in four languages.

---

# Español (вычитан носителем, задача 57н)

### es · название (30)
Arcanum — Aprende Tarot

### es · подзаголовок iOS (30)
Curso, significados y tiradas

### es · короткое описание Google (80)
Aprende a leer el tarot: curso de 32 lecciones, 78 cartas y tu carta del día

### es · ключевые слова iOS (100)
adivinacion,cartomancia,cartas,lectura,mazo,baraja,arcanos,luna,principiantes,diario,dia,rider,waite

### es · промо-текст iOS (170)
Arcanum 1.0 ya está aquí: curso de 32 lecciones, las 78 cartas explicadas, diez tiradas, entrenador de memoria y calendario lunar. Funciona sin conexión y sin cuenta.

### es · полное описание (4000)
Arcanum te enseña a leer el tarot desde cero: con calma, cinco minutos al día.

Aquí no hay una bola de cristal. Hay un curso: entiendes de dónde salen los significados y, poco a poco, empiezas a leer las cartas por tu cuenta.

QUÉ INCLUYE

• Un curso de 6 módulos y 32 lecciones. Teoría, análisis de cartas y una prueba corta al final de cada lección: 160 preguntas en total. Cada lección desbloquea la siguiente y tu racha de días te ayuda a no perder el ritmo.

• Una guía con las 78 cartas. De cada carta tienes su significado derecho e invertido, su lectura por áreas de la vida (amor, trabajo, dinero, salud), el simbolismo de la ilustración y lo que quiere decir como carta del día. Incluye búsqueda y filtros por arcanos y palos.

• Carta del día. Una carta cada mañana, con su lectura y una pregunta para fijar lo aprendido; por la noche, una reflexión corta sobre si te resonó o no. Todo se guarda en tu Diario, junto con tus notas.

• Diez tiradas: la de tres cartas, la cruz celta, la herradura, la de pareja, la de elección, la del mes y más. Cada posición lleva nombre y explicación, para que sepas qué significa cada lugar de la mesa.

• Entrenador de memoria. Tarjetas con repetición espaciada: la app elige qué carta te toca hoy para que los significados se te queden.

• Calendario lunar. Las fases, las lunas nuevas y las llenas se calculan con un algoritmo astronómico, no con una tabla aproximada. La luna nueva y la luna llena tienen sus propias tiradas.

• Diario. Guarda todas tus cartas del día y tus tiradas con notas, te muestra las estadísticas del mes y te deja exportar y restaurar todo desde un archivo.

CÓMO FUNCIONA

Arcanum funciona sin conexión: todo el contenido ya viene en la app y solo necesitas internet para comprar la suscripción. No hace falta crear una cuenta y no recopilamos datos: tu progreso y tus notas se quedan en tu dispositivo.

Disponible en cuatro idiomas: español, inglés, ruso y portugués.

ARCANUM PREMIUM

Gratis para siempre: la carta del día con su lectura, la guía completa de las 78 cartas con todas sus secciones, el Diario sin límites, los dos primeros módulos del curso, las tiradas “Tres cartas” y “Luna nueva”, y una sesión del Entrenador al día.

Premium desbloquea los módulos 3 a 6 del curso, el resto de las tiradas y el Entrenador sin límites. La suscripción se renueva automáticamente y puedes cancelarla cuando quieras desde los ajustes de tu cuenta en la tienda. Si algún día se vence, todo lo que ya hayas completado se queda contigo.

Arcanum es una app para aprender y entretenerte. No predice el futuro ni sustituye la consulta con un profesional.

Términos de uso: https://sivyankof.github.io/arcanum/terms.html
Política de privacidad: https://sivyankof.github.io/arcanum/privacy.html

### es · что нового (4000)
Esta es la primera versión de Arcanum.

Un curso de 32 lecciones, las 78 cartas con sus significados y su simbolismo, la carta del día con Diario y reflexión por la noche, diez tiradas, entrenador de memoria y calendario lunar. Funciona sin conexión y está disponible en cuatro idiomas.

---

# Português do Brasil (вычитан носителем, задача 57н)

### pt · название (30)
Arcanum — Aprenda a Ler Tarô

### pt · подзаголовок iOS (30)
Curso, significados e tiragens

### pt · короткое описание Google (80)
Aprenda a ler tarô: curso de 32 lições, as 78 cartas e a carta do dia

### pt · ключевые слова iOS (100)
taro,tarot,cartas,tiragem,leitura,baralho,arcanos,lua,adivinhacao,iniciantes,diario,waite,rider

### pt · промо-текст iOS (170)
Novidades da versão 1.0: curso de 32 lições, as 78 cartas explicadas, dez tiragens, treinador de memória e calendário lunar. Funciona offline, sem cadastro.

### pt · полное описание (4000)
O Arcanum ensina você a ler tarô do zero, com calma, cinco minutos por dia.

É um curso, não uma bola de cristal: você entende de onde vêm os significados e, aos poucos, passa a ler as cartas por conta própria.

O QUE VOCÊ ENCONTRA NO APP

• Um curso de 6 módulos e 32 lições. Teoria, análise das cartas e um teste curto no fim de cada lição, 160 perguntas no total. Cada lição libera a seguinte, e a ofensiva de dias ajuda a manter o ritmo.

• Um guia com as 78 cartas. Cada carta traz o significado normal e o invertido, a leitura por áreas da vida (amor, trabalho, dinheiro, saúde), o simbolismo da imagem e o sentido como carta do dia. Tem busca e filtros por arcanos e naipes.

• Carta do dia. Uma carta toda manhã, com a interpretação e uma pergunta para fixar o que você aprendeu; à noite, uma reflexão rápida: fez sentido ou não? Tudo fica salvo no seu diário, com espaço para anotações.

• Dez tiragens: Três Cartas, Cruz Celta, Ferradura, Relacionamento, Escolha, Mês e outras. Cada posição tem nome e explicação, assim você entende o que cada uma representa na leitura.

• Treino de memória. Flashcards com repetição espaçada: o app escolhe qual carta mostrar hoje para os significados ficarem na memória de vez.

• Calendário lunar. As fases, as luas novas e as luas cheias são calculadas com um algoritmo astronômico, e não com uma tabela aproximada. A lua nova e a lua cheia têm tiragens próprias.

• Diário. Todas as cartas do dia e todas as tiragens com suas anotações, as estatísticas do mês e backup em arquivo, para exportar e restaurar quando quiser.

COMO FUNCIONA

O app funciona offline: todo o conteúdo já vem instalado, e a internet só é necessária para assinar. Não precisa criar conta e nada é coletado: seu progresso e suas anotações ficam no seu aparelho.

Quatro idiomas: português, inglês, russo e espanhol.

ARCANUM PREMIUM

Grátis para sempre: a carta do dia com a interpretação, o guia completo das 78 cartas com todas as seções, o diário sem limites, os dois primeiros módulos do curso, as tiragens Três Cartas e Lua Nova e uma sessão do Treino por dia.

O Premium libera os módulos 3 a 6 do curso, as outras tiragens e o Treino sem limites. A assinatura é renovada automaticamente e pode ser cancelada nas configurações da loja. Se ela acabar, tudo o que você já concluiu continua com você.

Este aplicativo é para aprendizado e entretenimento. Ele não prevê o futuro e não substitui a consulta com um profissional.

Termos de uso: https://sivyankof.github.io/arcanum/terms.html
Política de privacidade: https://sivyankof.github.io/arcanum/privacy.html

### pt · что нового (4000)
Esta é a primeira versão do Arcanum.

Um curso de 32 lições, as 78 cartas com significados e simbolismo, a carta do dia com diário e reflexão à noite, dez tiragens, treinador de memória e calendário lunar. Funciona tudo offline, em quatro idiomas.

---

## Подписки (App Store Connect, залито 28.08; Play Console — те же тексты)

Группа подписок `Premium`, отображаемое название группы на всех языках — `Arcanum Premium`,
название приложения — из App Store. Лимиты Apple: название 35, описание 55 символов
(форма ASC показывает счётчик; в справке значились 30/45 — форма шире). Описание у годовой и
месячной одно и то же. Цены — решение 28.08: **$5.99/мес, $34.99/год** (США выставлены вручную,
остальное — автопересчёт магазина от витрины Грузии).

| Язык | `premium.year` | `premium.month` | Описание |
|---|---|---|---|
| ru | Premium — год | Premium — месяц | Весь курс, все расклады, тренажёр без лимита |
| en-US | Premium — Yearly | Premium — Monthly | Full course, all spreads, unlimited trainer |
| es-MX | Premium — Anual | Premium — Mensual | Todo el curso, tiradas, Entrenador ilimitado |
| pt-BR | Premium — Anual | Premium — Mensal | Todo o curso, tiragens e Treino sem limites |

**Google Play (Play Console → Подписки → `premium` → Сведения; залито 28.08).** Имя подписки
(≤ 55) везде `Arcanum Premium`; преимущества (≤ 40 каждое, по три на язык; ru — по умолчанию,
переводы en-US / es-419 / pt-BR); описание (≤ 200, покупателям не показывается) только для ru.

| Язык | Преимущество 1 | Преимущество 2 | Преимущество 3 |
|---|---|---|---|
| ru | Курс целиком — 6 модулей, 32 урока | Тренажёр без дневного лимита | Все расклады, включая Кельтский крест |
| en-US | Full course — 6 modules, 32 lessons | Trainer with no daily limit | All spreads, including Celtic Cross |
| es-419 | Curso completo: 6 módulos, 32 lecciones | Entrenador sin límite diario | Todas las tiradas, incl. Cruz Celta |
| pt-BR | Curso completo: 6 módulos, 32 lições | Treino sem limite diário | Todas as tiragens, incl. Cruz Celta |

Описание (ru): `Premium: весь курс, все расклады, тренажёр без лимита`. Базовые планы: `year`
(каждый год, $34.99) и `month` (каждый месяц, $5.99), цены по странам — автопересчёт Google.

**Информация для проверки подписок (App Store Connect, залито 28.08 вечером):** у `premium.year`
и `premium.month` — кадр пейвола с iPhone Артёма (1290×2796, обе цены магазина, «Восстановить
покупки» на экране) и одна заметка ревьюеру (en, 483 симв.; Sandbox-тестер не упоминается —
у ревью свой):

```
Screenshot shows the in-app subscription screen (Settings -> Arcanum Premium; it also opens from
any locked course module or spread). Both plans (yearly and monthly) are listed with store prices,
and 'Restore Purchases' is on the same screen. Premium unlocks course modules 3-6, the remaining
spreads and unlimited trainer sessions; the daily card, the full 78-card reference and the journal
stay free. Purchases go through StoreKit (RevenueCat SDK); no account or sign-in is needed.
```

Заголовки этого раздела намеренно не в формате `### lang · поле (лимит)` — парсер
`storeListing.test.ts` считает такие заголовки полями витрины и сверяет периметр языков.
