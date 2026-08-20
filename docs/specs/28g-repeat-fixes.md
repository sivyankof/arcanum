# Повторы, внесённые правками канона — задача 28г

Нашёл `check_edits.py` на приёмке 28б (35 внесённых тавтологий и 12 повторов с соседним блоком;
база честная — тот же прогон по старым текстам даёт 0 и 0). Здесь только те, что реально режут:
остальные — риторические подхваты вроде «стрелы Амура… стрелы летят в обе стороны», их не трогаем.

Формат совпадает с `canon-fixes.md`, поэтому применяется тем же инструментом:
`python scripts/apply_canon_fixes.py --fixes docs/specs/28g-repeat-fixes.md --apply --out <список>`,
дальше обязательно `python scripts/check_edits.py <список>` — своя правка склонна вносить дефект
того же класса (правило подтверждено пятый раз).

⚠️ Затронутые блоки есть на es/pt — после утверждения их обязана перезалить L-сессия.

#### Умеренность · Карта дня — повтор с блоком «Символика»

*Правка 28б сняла предсказание «День наградит вас…» и вписала образ ноги на земле и в воде — а он почти дословно стоит в `symbolism` той же карты. Оба блока рядом на вкладке «Общее» (спека 39), читатель видит одну фразу дважды. Замена держит ту же мысль о мере, но смещает фокус на процесс дня.*

**RU было:** Сегодня ищите середину. Не соглашайтесь на крайности — ни в делах, ни в разговорах, ни в тратах. Если назревает спор, предложите компромисс сами. Чередуйте напряжение и паузы: час работы — десять минут тишины. Одна нога на земле, другая в воде — так держится равновесие.

**RU станет:** Сегодня ищите середину. Не соглашайтесь на крайности — ни в делах, ни в разговорах, ни в тратах. Если назревает спор, предложите компромисс сами. Чередуйте напряжение и паузы: час работы — десять минут тишины. К вечеру оцените день не по сделанному, а по тому, насколько ровно вы шли.

**EN было:** Today, look for the middle path. Refuse extremes — in tasks, conversations and spending alike. If an argument is brewing, be the one who offers the compromise. Alternate effort with pauses: an hour of work, ten minutes of quiet. One foot on land, one in the water — that is how balance holds.

**EN станет:** Today, look for the middle path. Refuse extremes — in tasks, conversations and spending alike. If an argument is brewing, be the one who offers the compromise. Alternate effort with pauses: an hour of work, ten minutes of quiet. By evening, judge the day not by what got done but by how steady you kept.

- [ ] согласны

  Свой вариант:

#### Император · Карта дня — финал пересказывает начало блока

*«обозначьте границу» в первом предложении и «Если обозначаете границу» в последнем, плюс «спокойно» / «спокойный» рядом. Мысль о тоне сохраняется, повтор уходит.*

**RU было:** Сегодня наведите порядок в одном деле, до которого не доходили руки: разберите бумаги, составьте план, назначьте встречу, обозначьте границу в разговоре. Действуйте спокойно и твёрдо — без оправданий. Если обозначаете границу — спокойный тон удержит её дольше раздражённого.

**RU станет:** Сегодня наведите порядок в одном деле, до которого не доходили руки: разберите бумаги, составьте план, назначьте встречу, обозначьте границу в разговоре. Действуйте спокойно и твёрдо — без оправданий. Ровный голос удержит сказанное дольше, чем раздражённый.

**EN было:** Today, bring order to one thing you've been putting off: sort the papers, draft the plan, book the meeting, state a boundary in a conversation. Act calmly and firmly — no apologies needed. If you do state a boundary, a calm tone will hold it longer than an irritated one.

**EN станет:** Today, bring order to one thing you've been putting off: sort the papers, draft the plan, book the meeting, state a boundary in a conversation. Act calmly and firmly — no apologies needed. A level voice will hold what you said longer than an irritated one.

- [ ] согласны

  Свой вариант:

#### Справедливость · Общее значение — «решения» и «честный» дважды

*Вставленный правкой вопрос повторил и «решения», и «честность» из соседних предложений. Вопрос остаётся, слова меняются.*

**RU было:** Справедливость — карта причины и следствия. Сейчас всё встаёт на свои места: усилия вознаграждаются, а срезанные углы дают о себе знать. Это время честности — прежде всего с собой. Решения стоит принимать ясной головой, взвесив факты, а не эмоции. Сверьтесь с собственной совестью: какие решения вы готовы назвать честными, а какие — нет? Карта также говорит о договорах, документах и официальных вопросах.

**RU станет:** Справедливость — карта причины и следствия. Сейчас всё встаёт на свои места: усилия вознаграждаются, а срезанные углы дают о себе знать. Это время честности — прежде всего с собой. Решения стоит принимать ясной головой, взвесив факты, а не эмоции. Сверьтесь с собственной совестью: где вы поступаете прямо, а где — как удобно? Карта также говорит о договорах, документах и официальных вопросах.

**EN было:** Justice is the card of cause and effect. Things are falling into place: effort gets rewarded, and cut corners come back around. This is a time for honesty — above all with yourself. Make decisions with a clear head, weighing facts rather than emotions. Check in with your own conscience: which decisions would you call honest, and which would you not? The card also points to contracts, documents and official matters.

**EN станет:** Justice is the card of cause and effect. Things are falling into place: effort gets rewarded, and cut corners come back around. This is a time for honesty — above all with yourself. Make decisions with a clear head, weighing facts rather than emotions. Check in with your own conscience: where are you acting straight, and where simply as it suits you? The card also points to contracts, documents and official matters.

- [ ] согласны

  Свой вариант:

#### Девятка Жезлов · Любовь — «усталость» три раза подряд

*Финальная фраза «усталость от обороны — усталость от человека» работает как приём, но перед ней стоит ещё одно «усталость». Английский этой проблемы не имеет: там tired и exhaustion — разные слова, поэтому правится только русский.*

**RU было:** В любви — настороженность после прежних ран: хочется близости, но страшно снова довериться. Партнёру порой достаётся оборона, предназначенная кому-то из прошлого. Признайте свою усталость и говорите о ней словами, а не колкостями. Усталость от обороны легко принять за усталость от человека.

**RU станет:** В любви — настороженность после прежних ран: хочется близости, но страшно снова довериться. Партнёру порой достаётся оборона, предназначенная кому-то из прошлого. Признайте, что вымотаны, и говорите об этом словами, а не колкостями. Усталость от обороны легко принять за усталость от человека.

- [ ] согласны

  Свой вариант:
