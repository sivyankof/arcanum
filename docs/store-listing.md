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

```
Arcanum is an offline tarot learning app. No account or sign-up is required and no user data
leaves the device: progress, journal entries and settings are stored locally.

Free content: daily card with its meaning, the full 78-card reference (all sections), unlimited
journal, course modules 1-2, two spreads (Three Cards, New Moon), one flashcard session per day.

Premium subscription unlocks course modules 3-6, the remaining spreads and unlimited flashcard
sessions. Subscriptions are handled by RevenueCat over StoreKit; restore is available on the
paywall screen.

The app is educational and entertainment content about tarot symbolism. It does not claim to
predict the future and does not give medical, legal or financial advice; a disclaimer appears
during onboarding and on the About screen.
```

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

• Un manual con las 78 cartas. De cada carta tienes su significado derecho e invertido, su lectura por áreas de la vida (amor, trabajo, dinero, salud), el simbolismo de la ilustración y lo que quiere decir como carta del día. Incluye búsqueda y filtros por arcanos y palos.

• Carta del día. Una carta cada mañana, con su lectura y una pregunta para fijar lo aprendido; por la noche, una reflexión corta sobre si te resonó o no. Todo se guarda en tu Diario, junto con tus notas.

• Diez tiradas: la de tres cartas, la cruz celta, la herradura, la de pareja, la de elección, la del mes y más. Cada posición lleva nombre y explicación, para que sepas qué significa cada lugar de la mesa.

• Entrenador de memoria. Tarjetas con repetición espaciada: la app elige qué carta te toca hoy para que los significados se te queden.

• Calendario lunar. Las fases, las lunas nuevas y las llenas se calculan con un algoritmo astronómico, no con una tabla aproximada. La luna nueva y la luna llena tienen sus propias tiradas.

• Diario. Guarda todas tus cartas del día y tus tiradas con notas, te muestra las estadísticas del mes y te deja exportar y restaurar todo desde un archivo.

CÓMO FUNCIONA

Arcanum funciona sin conexión: todo el contenido ya viene en la app y solo necesitas internet para comprar la suscripción. No hace falta crear una cuenta y no recopilamos datos: tu progreso y tus notas se quedan en tu dispositivo.

Disponible en cuatro idiomas: español, inglés, ruso y portugués.

ARCANUM PREMIUM

Gratis para siempre: la carta del día con su lectura, el manual completo de las 78 cartas con todas sus secciones, el Diario sin límites, los dos primeros módulos del curso, las tiradas “Tres cartas” y “Luna nueva”, y una sesión del Entrenador al día.

Premium desbloquea los módulos 3 a 6 del curso, el resto de las tiradas y el Entrenador sin límites. La suscripción se renueva automáticamente y puedes cancelarla cuando quieras desde los ajustes de tu cuenta en la tienda. Si algún día se vence, todo lo que ya hayas completado se queda contigo.

Arcanum es una app para aprender y entretenerte. No predice el futuro ni sustituye la consulta con un profesional.

### es · что нового (4000)
Esta es la primera versión de Arcanum.

Un curso de 32 lecciones, las 78 cartas con sus significados y su simbolismo, la carta del día con Diario y reflexión por la noche, diez tiradas, entrenador de memoria y calendario lunar. Funciona sin conexión y está disponible en cuatro idiomas.

---

# Português do Brasil (вычитан носителем, задача 57н)

### pt · название (30)
Arcanum — Aprenda Tarô

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

• Um curso de 6 módulos e 32 lições. Teoria, análise das cartas e um teste curto no fim de cada lição, 160 perguntas no total. Cada lição libera a seguinte, e a sequência de dias ajuda a manter o ritmo.

• Um guia com as 78 cartas. Cada carta traz o significado normal e o invertido, a leitura por áreas da vida (amor, trabalho, dinheiro, saúde), o simbolismo da imagem e o sentido como carta do dia. Tem busca e filtros por arcanos e naipes.

• Carta do dia. Uma carta toda manhã, com a interpretação e uma pergunta para fixar o que você aprendeu; à noite, uma reflexão rápida: fez sentido ou não? Tudo fica salvo no seu diário, com espaço para anotações.

• Dez tiragens: Três Cartas, Cruz Celta, Ferradura, Relacionamento, Escolha, Mês e outras. Cada posição tem nome e explicação, assim você entende o que cada uma representa na leitura.

• Treinador de memória. Cartões com repetição espaçada: o app escolhe qual carta mostrar hoje para os significados ficarem na memória de vez.

• Calendário lunar. As fases, as luas novas e as luas cheias são calculadas com um algoritmo astronômico, e não com uma tabela aproximada. A lua nova e a lua cheia têm tiragens próprias.

• Diário. Todas as cartas do dia e todas as tiragens com suas anotações, as estatísticas do mês e backup em arquivo, para exportar e restaurar quando quiser.

COMO FUNCIONA

O app funciona offline: todo o conteúdo já vem instalado, e a internet só é necessária para assinar. Não precisa criar conta e nada é coletado: seu progresso e suas anotações ficam no seu aparelho.

Quatro idiomas: português, inglês, russo e espanhol.

ARCANUM PREMIUM

Grátis para sempre: a carta do dia com a interpretação, o guia completo das 78 cartas com todas as seções, o diário sem limites, os dois primeiros módulos do curso, as tiragens Três Cartas e Lua Nova e uma sessão do Treinador por dia.

O Premium libera os módulos 3 a 6 do curso, as outras tiragens e o Treinador sem limites. A assinatura é renovada automaticamente e pode ser cancelada nas configurações da loja. Se ela acabar, tudo o que você já concluiu continua com você.

Este aplicativo é para aprendizado e entretenimento. Ele não prevê o futuro e não substitui a consulta com um profissional.

### pt · что нового (4000)
Esta é a primeira versão do Arcanum.

Um curso de 32 lições, as 78 cartas com significados e simbolismo, a carta do dia com diário e reflexão à noite, dez tiragens, treinador de memória e calendário lunar. Funciona tudo offline, em quatro idiomas.
