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
| работает офлайн, без аккаунта, рекламы и слежки (App Privacy: Identifiers + Purchases «not linked», поэтому «без сбора данных» писать нельзя — 05.09) | master-plan §4, решение 22.08 |
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

- Категория: **Образование**; вторичная — **Справочники (Reference)** — решение 18.09 (задача 72,
  второй отказ 4.3(b)): «Стиль жизни» ассоциируется с эзотерикой сильнее, чем нейтральный
  «справочник». Не «Развлечения»: обучение проходит ревью мягче.
- Возрастной рейтинг: iOS **13+** (фактически выставлено в App Store Connect), Google — аналогично
  (эзотерическая тематика).
- Ответы на анкеты приватности: **данные не собираем**, аналитики в v1 нет. Наружу уходит только
  покупка подписки (чек и анонимный идентификатор установки в App Store / Google Play и RevenueCat) —
  декларировать как «Purchases / покупки, не связаны с личностью».

## Заметки для ревьюера (en, поле App Review Notes)

Версия 19.09 (задача 72, финальное ревью ветки): структура целиком пересобрана вокруг новой
навигации, а не вокруг возражения (заложено 18.09, поправлено 19.09 по двум находкам ревью).
Первым пунктом — что изменилось со сборки 3 (учебная панель первым экраном, карта дня и лунная
строка убраны с первого экрана, нумерация лунных дней убрана вовсе, онбординг без даты рождения,
новая вкладка «Учёба», игра-упражнение «Угадай карту»); вторым — путь ревьюера за 30 секунд,
**из которого убран шаг «Learn → Review»**: тренажёр (`ReviewPanel`) скрыт, пока колода флеш-карт
пуста, а она наполняется только уроками с картами — первый такой урок пятый по счёту (Модуль 2,
Урок 1), то есть на свежей установке за 30 секунд до тренажёра дойти нельзя. Путь оставлен полностью
исполнимым «как есть», а появление тренажёра описано отдельным предложением со ссылкой на запись
экрана; третьим — сама запись, теперь ОПИСАННАЯ ПРАВДИВО (пункт 3 ниже: новая, сборки 4, а не старая
сборки 3). Спорить по существу больше не с чем (показываем правки, а не аргументы), поэтому абзац
про 4.3(b) сжат до двух предложений и стоит перед пронумерованными пунктами. Прежние восемь пунктов
(SCREEN RECORDING…IN-APP PURCHASES) сохранены, но пронумерованы 3–10 и сжаты под новую навигацию
(ACCESS переписан, дата рождения — «optional, in Settings»). Длина — считать python-ом `len()`
(лимит — по счётчику поля ASC, `storeListing.test.ts` этот блок не парсит). Меняя факты
(устройства, цены, что свободно), править здесь, потом копировать в ASC. Версия 05.09 (ресабмит
после первого отказа, 3996 симв.) — в истории git.

```
Arcanum is an offline tarot LEARNING app: a course, a 78-card reference, spaced-repetition flashcards, a daily card with a journal, spreads and a moon calendar. No account or sign-up; progress, journal and settings stay on the device.

ON GUIDELINE 4.3(b). Arcanum has no astrology, horoscope or fortune-telling features and predicts nothing; its category is Education. This build leads with the course, quizzes and spaced-repetition practice from the first screen, so we ask that it be assessed on that functionality rather than on the tarot subject matter alone.

1. WHAT CHANGED SINCE THE PREVIOUS REVIEW. Build 4 reworks the app around learning. The first screen is now a learning dashboard: next course lesson (with progress), the "Review" spaced-repetition trainer, and a new "Guess the Card" recognition exercise. The daily card moved to its own secondary screen. The moon-phase row is gone from the first screen and lunar-day numbering is removed from the app entirely; a plain new/full-moon calendar stays one tap away, on Practice. Tabs renamed: Learn, Course, Cards, Practice, Profile. Build 4, version 1.0.0.

2. 30-SECOND REVIEWER PATH. Launch -> "Start learning" -> "To the first lesson" (2-step onboarding, no login) -> Learn tab, tap "Start lesson" -> theory -> a 5-question quiz with instant feedback. Course tab: 6 modules, 32 lessons, per-module progress (modules 1-2 free, 3-6 Premium). Learn or Practice -> "Guess the Card": a zoomed-in detail, four options, ten questions, free. "Review" (SM-2 trainer, one free session/day) appears on Learn/Course after Module 2 Lesson 1, the 5th lesson — shown in the recording.

3. SCREEN RECORDING. A walkthrough of build 4 from a physical iPhone, following the path above and on through the course to "Review", plus the paywall, a Sandbox purchase, unlocked content and Restore Purchases, is attached with this resubmission. The only system prompt is the notification permission.

4. DEVICES TESTED. iPhone 14 Pro Max and iPhone 17 Pro Max on iOS 26; ad hoc builds; Sandbox tester for purchases.

5. AUDIENCE. Adults and teens (13+) studying tarot symbolism as a hobby or self-reflection practice; disclaimer (no predictions, no medical, legal or financial advice) in onboarding and on About.

6. ACCESS. No login. First launch: 2-step onboarding (intro with disclaimer -> how the course works, optional name) -> Learn tab. Tabs: Learn, Course (modules 1-2 free), Cards, Practice (spreads; moon row and calendar here), Profile (Settings, About; birth date optional, in Settings).

7. EXTERNAL SERVICES. Purchases: StoreKit via the RevenueCat SDK (subscription status only; the app's only network service). Notifications are local. Privacy Policy, Terms of Use and support: static pages on GitHub Pages. No analytics, ads, authentication or AI.

8. REGIONAL DIFFERENCES. None. UI in English, Russian, Spanish and Portuguese; prices per storefront.

9. THIRD-PARTY MATERIAL. Not a regulated industry. Card images: Rider-Waite-Smith deck (Pamela Colman Smith, 1909), public domain, Wikimedia Commons scans. Some symbolism draws on A. E. Waite, "The Pictorial Key to the Tarot" (1911), public domain; all other text, including the card-meaning texts and quiz content, is original.

10. IN-APP PURCHASES. One auto-renewable group "Arcanum Premium": Premium - Yearly (premium.year, 1 year, USD 34.99) and Premium - Monthly (premium.month, 1 month, USD 5.99); no trial. Premium unlocks course modules 3-6, most spreads and unlimited flashcard sessions; free forever: the learning dashboard, modules 1-2, "Guess the Card", the daily card, the 78-card reference, the journal, the Three Cards and New Moon spreads, one flashcard session a day. Where to buy: Profile -> Settings -> "Arcanum Premium", or any locked module or spread. The paywall lists both plans with store price, Terms of Use and Privacy Policy links and "Restore Purchases"; after purchase it shows the active plan and renewal date.

Contact: arcanum.tarot@icloud.com.
```

Прежние версии (483 симв. до 29.08; восемь пунктов без 4.3(b), 3944 симв., 29.08; ресабмит
после первого отказа 4.3(b), 3996 симв., 05.09) — в истории git.

---

# Русский

### ru · название (30)
Arcanum — обучение таро

### ru · подзаголовок iOS (30)
Курс, значения карт, расклады

### ru · короткое описание Google (80)
Учитесь читать таро: курс из 32 уроков, 78 карт со значениями и тренажёр памяти

### ru · ключевые слова iOS (100)
уроки,расклад,колода,арканы,старшие,символика,карта дня,уэйт,новичкам,викторина,тренажёр,символы

### ru · промо-текст iOS (170)
Новое в 1.0: курс из 32 уроков с викторинами, справочник 78 карт, десять раскладов, тренажёр памяти и упражнение «Угадай карту». Всё работает офлайн, без регистрации.

### ru · полное описание (4000)
Arcanum учит читать таро с нуля — спокойно, по 5 минут в день.

Не гадальный автомат, а курс: вы разбираетесь, откуда берутся значения карт, и постепенно начинаете читать их сами.

ЧТО ВНУТРИ

• Курс из 6 модулей и 32 уроков. Теория, разбор карт и короткий тест после каждого урока — 160 вопросов на весь курс. Следующий урок открывается после предыдущего, прогресс и серия дней помогают не бросить.

• Справочник всех 78 карт. У каждой — общее значение и перевёрнутое, разбор по сферам (любовь, работа, финансы, здоровье), символика рисунка и значение в роли карты дня. Поиск и фильтры по арканам и мастям.

• Десять раскладов: три карты, кельтский крест, подкова, на отношения, на выбор, на месяц и другие. Позиции подписаны и объяснены — видно, что означает каждое место.

• Тренажёр памяти. Флеш-карты по алгоритму интервального повторения: приложение само решает, какую карту показать сегодня, чтобы значения запоминались надолго.

• Угадай карту. Короткое упражнение: по увеличенному фрагменту рисунка нужно узнать аркан среди четырёх вариантов — разминка для памяти на символику колоды.

• Дневник. Все карты дня и расклады с заметками, статистика месяца, экспорт и восстановление данных файлом.

• Карта дня и календарь. Каждое утро — новая карта с толкованием и вопросом для закрепления; отдельно — спокойный календарь новолуний и полнолуний.

КАК УСТРОЕНО

Приложение работает офлайн: весь контент лежит внутри, интернет нужен только для покупки подписки. Аккаунт не нужен, рекламы и слежки нет — прогресс и записи хранятся на вашем устройстве.

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
Learn to read tarot: a 32-lesson course, all 78 cards explained, memory trainer

### en · ключевые слова iOS (100)
lessons,quiz,deck,arcana,symbolism,study,reading,daily,journal,flashcards,beginners,rider,waite

### en · промо-текст iOS (170)
New in 1.0: a 32-lesson course with quizzes, 78 cards explained, ten spreads, a memory trainer and a Guess the Card exercise. Everything works offline, no sign-up needed.

### en · полное описание (4000)
Arcanum teaches you to read tarot from scratch — calmly, five minutes a day.

It is a course, not a fortune-telling machine: you learn where card meanings come from and gradually start reading the cards yourself.

WHAT'S INSIDE

• A course of 6 modules and 32 lessons. Theory, card walkthroughs and a short quiz after every lesson — 160 questions in total. Each lesson unlocks the next one, and streaks keep you coming back.

• A reference of all 78 cards. Every card has its upright and reversed meaning, a breakdown by area of life (love, work, money, health), the symbolism of the drawing and what it means as a card of the day. Search and filters by arcana and suit.

• Ten spreads: three cards, Celtic cross, horseshoe, relationship, choice, month ahead and more. Every position is named and explained, so you can see what each place stands for.

• Memory trainer. Flashcards with spaced repetition: the app decides which card to show today so the meanings stay with you.

• Guess the Card. A short exercise: identify the arcana from a zoomed-in detail of its artwork among four options — a quick warm-up for your memory of the deck's symbols.

• Journal. Every daily card and spread with your notes, monthly statistics, export and restore from a file.

• Card of the day and calendar. One card each morning with its reading and a question to make it stick; separately, a calm calendar of new moons and full moons.

HOW IT WORKS

The app works offline: all content is bundled inside, and the internet is only needed to buy a subscription. No account, no ads, no tracking — your progress and notes stay on your device.

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

⚠️ **Черновик задачи 72, носитель не читал** (19.09): короткое описание Google, ключевые слова iOS,
промо-текст iOS и два абзаца полного описания («Adivina la Carta» — упражнение на распознавание
символов; «Carta del día y calendario» — объединённый абзац карты дня и календаря вместо прежних
двух) переписаны под учебный главный экран и игру «Угадай карту». Остальные абзацы (курс,
справочник, расклады, тренажёр, дневник) — вычитка 57н, не тронуты. Волна 68 (`docs/prompts/
68-native-tails.md`, часть 3) обязана прочитать именно эти блоки.

### es · название (30)
Arcanum — Aprende Tarot

### es · подзаголовок iOS (30)
Curso, significados y tiradas

### es · короткое описание Google (80)
Aprende a leer tarot: curso de 32 lecciones, 78 cartas y entrenador de memoria

### es · ключевые слова iOS (100)
lecciones,simbolismo,cartas,lectura,mazo,baraja,arcanos,estudio,principiantes,diario,dia,rider,waite

### es · промо-текст iOS (170)
Arcanum 1.0: curso de 32 lecciones con cuestionarios, 78 cartas explicadas, diez tiradas, entrenador de memoria y el ejercicio Adivina la Carta. Sin conexión ni cuenta.

### es · полное описание (4000)
Arcanum te enseña a leer el tarot desde cero: con calma, cinco minutos al día.

Aquí no hay una bola de cristal. Hay un curso: entiendes de dónde salen los significados y, poco a poco, empiezas a leer las cartas por tu cuenta.

QUÉ INCLUYE

• Un curso de 6 módulos y 32 lecciones. Teoría, análisis de cartas y una prueba corta al final de cada lección: 160 preguntas en total. Cada lección desbloquea la siguiente y tu racha de días te ayuda a no perder el ritmo.

• Una guía con las 78 cartas. De cada carta tienes su significado derecho e invertido, su lectura por áreas de la vida (amor, trabajo, dinero, salud), el simbolismo de la ilustración y lo que quiere decir como carta del día. Incluye búsqueda y filtros por arcanos y palos.

• Diez tiradas: la de tres cartas, la cruz celta, la herradura, la de pareja, la de elección, la del mes y más. Cada posición lleva nombre y explicación, para que sepas qué significa cada lugar de la mesa.

• Entrenador de memoria. Tarjetas con repetición espaciada: la app elige qué carta te toca hoy para que los significados se te queden.

• Adivina la Carta. Un ejercicio breve: reconoce el arcano a partir de un detalle ampliado de su dibujo entre cuatro opciones — un buen calentamiento para recordar los símbolos de la baraja.

• Diario. Guarda todas tus cartas del día y tus tiradas con notas, te muestra las estadísticas del mes y te deja exportar y restaurar todo desde un archivo.

• Carta del día y calendario. Cada mañana, una carta con su lectura y una pregunta para fijar lo aprendido; aparte, un calendario tranquilo de lunas nuevas y llenas.

CÓMO FUNCIONA

Arcanum funciona sin conexión: todo el contenido ya viene en la app y solo necesitas internet para comprar la suscripción. No hace falta crear una cuenta, y no hay publicidad ni rastreo: tu progreso y tus notas se quedan en tu dispositivo.

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

⚠️ **Черновик задачи 72, носитель не читал** (19.09): короткое описание Google, ключевые слова iOS,
промо-текст iOS и два абзаца полного описания («Adivinhe a Carta» — упражнение на распознавание
символов; «Carta do dia e calendário» — объединённый абзац карты дня и календаря вместо прежних
двух) переписаны под учебный главный экран и игру «Угадай карту». Остальные абзацы (курс,
справочник, расклады, тренажёр, дневник) — вычитка 57н, не тронуты. Волна 68 (`docs/prompts/
68-native-tails.md`, часть 3) обязана прочитать именно эти блоки.

### pt · название (30)
Arcanum — Aprenda a Ler Tarô

### pt · подзаголовок iOS (30)
Curso, significados e tiragens

### pt · короткое описание Google (80)
Aprenda a ler tarô: curso de 32 lições, as 78 cartas e treino de memória

### pt · ключевые слова iOS (100)
taro,tarot,cartas,tiragem,leitura,baralho,arcanos,estudo,licoes,iniciantes,diario,waite,rider

### pt · промо-текст iOS (170)
Novidades 1.0: curso de 32 lições com questionários, 78 cartas explicadas, dez tiragens, treino de memória e o exercício Adivinhe a Carta. Offline, sem cadastro.

### pt · полное описание (4000)
O Arcanum ensina você a ler tarô do zero, com calma, cinco minutos por dia.

É um curso, não uma bola de cristal: você entende de onde vêm os significados e, aos poucos, passa a ler as cartas por conta própria.

O QUE VOCÊ ENCONTRA NO APP

• Um curso de 6 módulos e 32 lições. Teoria, análise das cartas e um teste curto no fim de cada lição, 160 perguntas no total. Cada lição libera a seguinte, e a ofensiva de dias ajuda a manter o ritmo.

• Um guia com as 78 cartas. Cada carta traz o significado normal e o invertido, a leitura por áreas da vida (amor, trabalho, dinheiro, saúde), o simbolismo da imagem e o sentido como carta do dia. Tem busca e filtros por arcanos e naipes.

• Dez tiragens: Três Cartas, Cruz Celta, Ferradura, Relacionamento, Escolha, Mês e outras. Cada posição tem nome e explicação, assim você entende o que cada uma representa na leitura.

• Treino de memória. Flashcards com repetição espaçada: o app escolhe qual carta mostrar hoje para os significados ficarem na memória de vez.

• Adivinhe a Carta. Um exercício curto: reconheça o arcano a partir de um detalhe ampliado do desenho entre quatro opções — um bom aquecimento para lembrar os símbolos do baralho.

• Diário. Todas as cartas do dia e todas as tiragens com suas anotações, as estatísticas do mês e backup em arquivo, para exportar e restaurar quando quiser.

• Carta do dia e calendário. Toda manhã, uma carta com sua interpretação e uma pergunta para fixar o que você aprendeu; à parte, um calendário tranquilo de luas novas e cheias.

COMO FUNCIONA

O app funciona offline: todo o conteúdo já vem instalado, e a internet só é necessária para assinar. Não precisa criar conta, e não há anúncios nem rastreamento: seu progresso e suas anotações ficam no seu aparelho.

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
