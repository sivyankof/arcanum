# Промт задачи 68 · Вычитка носителем хвостов es/pt (строки задач 53/54/59/62/53б/67/72 и страницы `site/`)

Волна 28н (21.08) закрыла долг по строкам, которые сессии написали ДО неё. После 21.08 сессии
написали ещё ~25 UI-строк и четыре страницы сайта на четырёх языках — **испанский и португальский
в них не читал ни один носитель**. Эта задача закрывает новый долг одним заходом, как 28н.
Периметр расширен 19.09 задачей 72 (учебный главный экран + игра «Угадай карту») — часть 1а и
часть 3 ниже.

Прочитай сначала: раздел глоссариев ES / PT-BR в `docs/content-guide.md` (норма языка, правило
безличного рода), промт 28н (`docs/prompts/28n-native-review.md` — те же правила) и отчёт 57н
в `docs/store-listing.md`, где термины интерфейса уже приведены к решениям 24.08.

## Периметр

### Часть 1 — UI-строки в `src/lib/i18n.ts` (секции `es` и `pt`)

| Ключ | Откуда | es сейчас | pt сейчас |
|---|---|---|---|
| `ob.disclaimer` | 54 (первый шаг онбординга) | Para entretenimiento y aprendizaje: la app no predice el futuro ni sustituye la consulta con un profesional. | Para entretenimento e aprendizado: o app não prevê o futuro nem substitui a orientação de um profissional. |
| `about.disclaimer` | 54 («О приложении» + `terms.html`) | La app está hecha con fines de entretenimiento y educación. No predice el futuro ni sustituye una consulta profesional — médica, legal, financiera o psicológica. | O app foi criado para fins de entretenimento e educação. Ele não prevê o futuro e não substitui orientação profissional — médica, jurídica, financeira ou psicológica. |
| `about.dataText` | 54 + 67 (четыре абзаца, = `privacy.html`) | (см. файл, 4 абзаца) | (см. файл, 4 абзаца) |
| `about.termsText` | 53 (условия подписки, = `terms.html`) | (см. файл) | (см. файл) |
| `about.openPrivacy` / `openTerms` / `openSupport` | 54 (текст-ссылки) | Abrir la política en el navegador / Abrir los términos en el navegador / Página de soporte | Abrir a política no navegador / Abrir os termos no navegador / Página de suporte |
| `settings.name` / `nameEmpty` | 59 (строка настроек) | Nombre / Sin indicar | Nome / Não informado |
| `settings.birthDate` / `birthEmpty` | 59 | Fecha de nacimiento / Indicar | Data de nascimento / Informar |
| `settings.save` / `cancel` | 59 (диалог ввода имени) | Guardar / Cancelar | Salvar / Cancelar |
| `paywall.soonTitle` | 62 (заголовок панели «покупок нет») | Aún no es posible suscribirse | Ainda não é possível assinar |
| `paywall.soonSub` | 62 | Inténtalo más tarde: todo lo que ya está abierto seguirá disponible | Tente mais tarde: tudo o que já está aberto continua disponível |
| `paywall.unavailableText` | 62 (текст диалога) | Las compras aún no están disponibles. Inténtalo más tarde. | As compras ainda não estão disponíveis. Tente mais tarde. |
| `paywall.activeYear` / `activeMonth` | 53б (панель активной подписки) | Suscripción anual / Suscripción mensual | Assinatura anual / Assinatura mensal |
| `paywall.activeExpires` | 53б (`{{date}}` — дата из магазина) | Válida hasta {{date}} | Válida até {{date}} |
| `paywall.errorTitle` / `errorText` | 53б (диалог «магазин не ответил») | Algo salió mal / La tienda no respondió. Revisa tu conexión e inténtalo de nuevo. | Algo deu errado / A loja não respondeu. Verifique sua conexão e tente de novo. |
| `paywall.restoreNoneTitle` / `restoreNoneText` | 53б (диалог «подписка не найдена») | No se encontró la suscripción / Esta cuenta de App Store / Google Play no tiene una suscripción activa de Arcanum Premium. | Assinatura não encontrada / Esta conta da App Store / Google Play não tem uma assinatura ativa do Arcanum Premium. |

`paywall.discount` (`−{{pct}} %`) — число, не читать.

⚠️ `settings.nameEmpty`/`birthEmpty` — значения СПРАВА в строке настроек, рядом с «Тёмная»/«Русский»:
одно-два слова, иначе строка переносится. `paywall.activeYear`/`activeMonth` — заголовок панели
шрифтом Cormorant, помещается ~22 знака.
⚠️ `about.dataText` и `about.termsText` — это те же тексты, что на `privacy.html` / `terms.html`
(см. часть 2): правишь одно место — правь второе побайтово, иначе контракт `site.test.ts` красный.
⚠️ Задача 72 (19.09) добавила в оба текста параметр `{{store}}` (три места на язык — риск 2.3.10):
правь формулировку вокруг подстановки, саму `{{store}}` не трогай — её заполняет код (`STORE_NAME`).

### Часть 1а — новые строки задачи 72 (`src/lib/i18n.ts`, секции `es`/`pt`)

| Ключ | Откуда | es сейчас | pt сейчас |
|---|---|---|---|
| `ob.start` | 72 (первый шаг онбординга, было «НАЧАТЬ ПУТЬ») | EMPEZAR A APRENDER | COMEÇAR A APRENDER |
| `ob.how1` | 72 (второй шаг «Как устроен курс») | 32 lecciones de cinco minutos: de la estructura de la baraja a las tiradas | 32 aulas de cinco minutos — da estrutura do baralho às tiragens |
| `ob.how2` | 72 | Un breve cuestionario después de cada lección | Um quiz curto depois de cada aula |
| `ob.how3` | 72 | El entrenador te recuerda qué cartas toca repasar | O treino lembra quais cartas está na hora de revisar |
| `ob.toCourse` | 72 (CTA второго шага) | A LA PRIMERA LECCIÓN | PARA A PRIMEIRA AULA |
| `today.tapToReveal` | 72 (было «TOCA PARA REVELAR»/«TOQUE PARA REVELAR») | TOCA PARA GIRAR | TOQUE PARA VIRAR |
| `today.meaning` | 72 (было «SIGNIFICADO DEL DÍA»/«SIGNIFICADO DO DIA») | SIGNIFICADO DE LA CARTA | SIGNIFICADO DA CARTA |
| `today.continue` | 72 (было «CONTINUAR TU CAMINO →»/аналог pt) | ESTUDIAR LA CARTA → | ESTUDAR A CARTA → |
| `home.title` | 72 (заголовок «Учёбы») | Aprender | Aprender |
| `home.lessonOf` | 72 (оверлайн героя) | MÓDULO {{m}} · LECCIÓN {{n}} DE {{total}} | MÓDULO {{m}} · AULA {{n}} DE {{total}} (⚠️ «aula», не «lição» — термин занят `course.lessons`/`startLesson`) |
| `home.ctaStart`/`ctaContinue`/`ctaPremium`/`ctaReview` | 72 (CTA героя по состоянию) | EMPEZAR LA LECCIÓN / CONTINUAR EL CURSO / DESBLOQUEAR PREMIUM / IR AL ENTRENADOR | COMEÇAR A AULA / CONTINUAR O CURSO / DESBLOQUEAR PREMIUM / IR PARA O TREINO |
| `home.courseDone` | 72 | Curso completado | Curso concluído |
| `home.dailyHint`/`dailyDrawn`/`dailyReflect` | 72 (строка «Карта дня») | Una carta al día: así la baraja se aprende sola / Carta del día · abierta / Tu pregunta de la noche te espera | Uma carta por dia — assim o baralho se fixa sozinho / Carta do dia · aberta / Sua pergunta da noite está esperando |
| `game.overline`/`title`/`sub` | 72 (панель входа в игру) | JUEGO / Adivina la carta / Reconoce el arcano por un detalle del dibujo | JOGO / Adivinhe a carta / Reconheça o arcano por um detalhe do desenho |
| `game.question` | 72 | ¿Qué carta es? | Que carta é esta? |
| `game.resultLine` | 72 (`{{right}}`/`{{total}}`) | {{right}} DE {{total}} CORRECTAS | {{right}} DE {{total}} CORRETAS |
| `game.again` | 72 | Otra vez | De novo |
| `review.toLearn` | 72 (пустое состояние тренажёра с «Учёбы», было только `toCourse`) | A APRENDER | IR PARA APRENDER |

⚠️ `home.lessonOf`/`game.resultLine` — числа и плейсхолдеры `{{m}}`/`{{n}}`/`{{total}}`/`{{right}}`
не трогать, форма «из 32» одна, без плюрализации (как в ru/en). `game.overline`/`ob.start`/CTA —
капслок, как остальные оверлайны и кнопки этих языков.

### Часть 2 — страницы `site/` (секции `<section data-lang="es">` и `data-lang="pt">`)

`site/index.html`, `site/privacy.html`, `site/terms.html`, `site/support.html`, `site/404.html` —
написаны сессией 22.08 (54), абзац об удалении данных дописан 28.08 (67). На них ссылаются
магазины (политика, условия, поддержка) и пейвол — это первое, что читает ревьюер на языке.

Контракт `src/lib/__tests__/site.test.ts` держит равенство «страница = приложение» на каждом языке:
- каждый из четырёх абзацев `about.dataText` (разделитель `\n\n`) содержится в `privacy.html` дословно;
- `about.termsText` и `about.disclaimer` содержатся в `terms.html` дословно;
- якорь `id="deletion-<lang>"` стоит внутри секции своего языка (заголовок §8 — не переименовывать
  без сохранения `id`).

Правку такого абзаца делаешь в ДВУХ местах: `i18n.ts` и `.html`. Остальной текст страниц (шапки,
§1–§7, «поддержка», 404) от приложения не зависит — правь свободно.

**Русский и английский не трогать ни байтом.**

### Часть 3 — витрина: подписи кадров и текст `docs/store-listing.md` (задача 72, 19.09)

`docs/store/captions.json` — блок `"fragment"` (подпись кадра игры «Угадай карту») написан
задачей 72 на всех четырёх языках; es/pt не читал носитель:

| Поле | es сейчас | pt сейчас |
|---|---|---|
| `screens.fragment[0]` (заголовок, ≤25) | Adivina la carta | Adivinhe a carta |
| `screens.fragment[1]` (подпись, ≤46) | Ejercicio para reconocer símbolos de la baraja | Exercício para reconhecer símbolos do baralho |

В `docs/store-listing.md` задача 72 переписала часть es/pt-блоков под секциями `# Español` и
`# Português do Brasil` (в файле они помечены отдельной пометкой «черновик задачи 72, носитель
не читал» — искать по этой фразе): короткое описание Google, ключевые слова iOS, промо-текст iOS
и два абзаца полного описания («Adivina la Carta»/«Adivinhe a Carta» — сам факт игры, и «Carta del
día y calendario»/«Carta do dia e calendário» — объединённый абзац карты дня и календаря вместо
двух прежних). Остальные абзацы этих описаний (курс, справочник, расклады, тренажёр, дневник) уже
вычитаны носителем волной 57н — не трогать их формулировки, только сверить длины после правки
соседних блоков (лимиты держит `storeListing.test.ts`).

## Правила (те же, что в 28н и 57н)

1. **Норма языка.** es — нейтральный латиноамериканский, `tú`, без `vosotros`/`os`/`vuestro`;
   pt — бразильский, `você`, без европеизмов (`aplicação` → `aplicativo`/`app`, `ecrã`, `telemóvel`).
2. **Читать вслух.** Юридический текст особенно склонен к кальке с русского («данные не покидают
   телефон», «право на Premium», «сама подписка остаётся у магазина»). Споткнулся — переписывай,
   но смысл абзаца обязан остаться тем же: политика описывает реальное поведение приложения
   (нет аккаунтов, серверов, аналитики, рекламы; RevenueCat получает чек и анонимный
   идентификатор; удаление по письму в 30 дней) — факты не менять и не смягчать.
3. **Термины = интерфейс** (решения 24.08, уже во всех местах):

   | смысл | es | pt |
   |---|---|---|
   | расклад | `tirada` | `tiragem` |
   | тренажёр | `Entrenador` | `Treino` |
   | флеш-карты | `flashcards` | `flashcards` |
   | серия дней | `racha` | `ofensiva` |
   | дневник | `Diario` | `Diário` |
   | справочник | `guía` | (см. `i18n.ts`) |
   | подписка / Premium | `suscripción` / `Arcanum Premium` | `assinatura` / `Arcanum Premium` |

   Хочешь другой термин — отдельной строкой с пометкой «меняется во всех местах» и перечнем файлов.
4. **Безличный род** для читателя (`content-guide`): «Não informado», а не «Não informada».
5. **Плейсхолдеры** `{{date}}`, `{{pct}}` и адрес `arcanum.tarot@icloud.com` — побайтово.
6. **Названия кнопок магазинов** — как в самих магазинах на этом языке: «Restaurar compras»;
   проверь, что регистр и кавычки внутри `dataText` совпадают с тем, как это слово стоит
   в `paywall.restore` (`i18n.ts`).

## Что сдать

1. Правки в `src/lib/i18n.ts` (секции `es`/`pt`, включая часть 1а) и `site/*.html` (секции es/pt).
2. Правки `docs/store/captions.json` (блок `fragment`) и `docs/store-listing.md` (см. часть 3) —
   после правки снять пометку «черновик задачи 72, носитель не читал» у тронутых блоков.
3. `docs/specs/68-changed-addresses.md` — таблица «ключ или файл+§ · язык · было · стало · почему»
   (почему — одним словом: калька / норма / термин / род / длина).
4. Зелёные `npm test` (в первую очередь `site.test.ts` 35/35, `storeListing.test.ts` 132/132
   и `langSources.test.ts`) и `npx tsc --noEmit`. Если правка абзаца `dataText` сделана в одном
   месте — тест это покажет, вторая половина обязательна.
5. Отдельным списком — вопросы, где нужно решение автора (термин, длина, факт).

Коммит: `content: вычитка носителем хвостов es/pt — строки 53/54/59/62/53б/67/72 и site/ (spec 68)`.
Ветка `feat/68-native-tails`, патч через `git format-patch` — как в 28с/57н/60.
