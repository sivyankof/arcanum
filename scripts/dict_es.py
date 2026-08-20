# -*- coding: utf-8 -*-
"""Словари корпусных проверок для ИСПАНСКОГО (по образцу scripts/check_canon.py, стр. 34–205).

Калибровано на живом корпусе: content/cards.json, 78 карт × 13 блоков, 958 непустых
испанских блоков (22 Старших + 56 Младших; birth_path есть только у Старших — 22 блока).

Метод, как и в русско-английских словарях: каждая формулировка прогонялась по всем 958
блокам, все находки просматривались глазами и делились на дефекты и шум. Порог тот же:
если ложных больше трети — регулярка сужается и прогоняется заново. Ниже в комментариях
записаны числа по каждой отброшенной попытке, чтобы следующий человек не проверял
заново уже проверенные ловушки.

⚠️ ГЛАВНОЕ ОТЛИЧИЕ ОТ РУССКОГО: испанский ломается не там, где русский.
   * Род читателя вылезает не в глаголе прошедшего времени, а в СОГЛАСОВАНИИ
     прилагательного/причастия со связкой — и потому ловится якорем на подлежащее
     (связка/инфинитив), а не на само прилагательное.
   * Границы слова важнее, чем в русском: «est[áa]s» без \\b сидит внутри «apuestas»,
     «respuestas», «bienestar»; «eres» — внутри «quieres», «esperas»; «se» — внутри
     «sé». Каждая из этих ловушек реально сработала при калибровке, числа ниже.
"""

# --- 1. PREDICTION ------------------------------------------------------------
#
# Рамка предсказания: приложение про рефлексию, а не «вас ждёт».
# Ловим УЗКИЙ класс: обещает КАРТА, обещано внешнее благо, названа неизбежность.
#
# ⚠️ ЗАМЕР ПО БУДУЩЕМУ ВРЕМЕНИ (задание требовало убедиться, а не поверить на слово).
#   Наивное `\w+r[áa]s` даёт 265 совпадений в 230 блоках — но это АРТЕФАКТ: 40 из них
#   «palabras», 31 «detrás», 31 «mientras», 17 «atrás», 11 «compras»… Настоящих форм
#   футурума в корпусе всего 20 на 958 блоков (estarás ×3, habrá ×2, será, serás,
#   volverás, llegarás, llegarán, traerá, hará, compensará, tomarán, funcionará,
#   estará, estarán, notará, recordará, arreglaré), «va/vas a + inf» — ещё 9.
#   Все 29 просмотрены: все законны. Половина — это конъектурное «¿no estarás
#   viviendo en aceleración permanente?» (Carro, Espadas 7/10/11), остальное —
#   следствие в условной конструкции («si no, llegarás a la meta sin nada en el
#   depósito»). Вывод тот же, что в русском: широкий футурум НЕ берём, ловим не
#   глагол будущего, а обещание внешнего блага.
#
# ⚠️ ЧТО ОТБРОСИЛ, С ЧИСЛАМИ:
#   * голое `promet` — 17 находок, настоящих 0. Ровно русская история с «обеща»:
#     14 про обещания ЛЮДЕЙ («no prometas aquello que no puedes sostener»,
#     «quien promete y no cumple», «un pago prometido»), 3 — законное отрицание
#     «La carta NO promete premios enormes / mejoras bruscas / ganancias inmediatas»
#     (Estrella, Espadas 6, Oros 7). Отрицание снимает рамку предсказания, а не
#     ставит её, — отсекается через (?!no\b) сразу после «carta».
#   * `garant` — 2 находки, обе ложные: «sin garantías» (Loco), «las garantías de
#     otros» (Sacerdotisa). В набор берём только «la carta garantiza».
#   * голое `destin\w*` — 2 находки, обе ложные: «destino y providencia tejidos
#     juntos» (Rueda, symbolism — иконография) и повелительное «Destina una parte a
#     otros» (Oros 6). Берём только «el destino» / «está escrito» / «destinado a».
#   * `\bel futuro\b` — 6 находок, все ложные («la conversación sobre el futuro»,
#     «invertir en el futuro común»). Выброшено целиком.
#   * `te dará|te traerá` — 2 находки, обе ложные и обе условные («El trabajo que
#     amas te dará más que el que solo paga»). Оставлены только «te concederá /
#     te regalará / te recompensará / te lo agradecerá» — их в корпусе 0.
#   * `anuncia|presagia|señal de que` — 13 находок, все ложные: 12 из них в блоках
#     symbolism описывают КАРТИНКУ («Las montañas lejanas anuncian las pruebas»,
#     «señal de que detrás de cada final hay un amanecer»). Выброшено целиком.
#   * `adivin\w*` — 3 находки, все ложные («esperas que adivinen lo que sientes»,
#     «en vez de adivinanzas»). Оставлено только существительное «adivinación».
#   * `profec[íi]a` — 1 находка и та в отрицании («los peores escenarios no son
#     profecías, sino señales de cansancio», Espadas 9). Выброшено.
#   * present-tense «el dinero llega/entra» — 4 находки (Emperatriz, Bastos 6,
#     Copas 1, Oros 2). Это жанровое описание значения масти в блоке finances,
#     а не обещание («El dinero llega como reconocimiento de tu trabajo»).
#     Русская регулярка настоящего времени тоже не ловит — не берём, но здесь
#     проходит граница: если появится «el dinero llegará», сработает ветка ниже.
#
# ⚠️ РЕДАКЦИЯ 3 (после прогона по ТЕКСТАМ КУРСА, content/course.json:
#   32 урока теории + 160 вопросов викторины). Курс — другой жанр: он не обращается
#   к читателю, а ОБЪЯСНЯЕТ, и его сквозная тема — «чем таро НЕ является».
#   Первая редакция дала там 8 испанских срабатываний, настоящих 2. Разбор:
#   * `\bpredicci[óo]n\w*` голым — 2 ложных, оба контрастивные:
#     «en eso la reflexión SE DIFERENCIA DE la predicción» (m6l3.q1_explain),
#     «habla de claridad y franqueza, NO DE predecir un desenlace» (m6l4.q5_explain).
#     Отрицание стоит далеко и слева, а в питоновском `re` lookbehind обязан быть
#     фиксированной длины — «не ближе N знаков от “no”» регуляркой не выражается.
#     Поэтому голое существительное выброшено: оставлено только
#     «predicción exacta/segura/certera/cerrada/del futuro» и «adivinar el futuro» —
#     то есть форма, в которой предсказание УТВЕРЖДАЕТСЯ, а не отрицается.
#   * `\bel\s+destino\b` голым — 2 ложных: «el tarot NO ES PREDECIR el destino ni
#     una “bola mágica”» (m1l1.theory) и «la mayor parte de la vida no son giros
#     del destino» (m4l1.theory). Сужено до распорядительного глагола:
#     el destino + decide/hará/dispone/manda/quiere/tiene reservado.
#   * Кавычки «…» как маркер цитируемого заблуждения — 2 ложных, и оба именно
#     кавычечные: «que decida el destino» no es la conclusión de esta carta, SINO SU
#     TRAMPA (m3l2.theory) и вариант викторины «el destino lo hará todo por mí»
#     на вопрос «¿Cuál es la trampa de La Rueda?» (m3l2.q2_opt1).
#     ⚠️ Второй случай НЕ снимается штатным `_without_distractors` из check_canon.py:
#        функция вырезает ключи на `_wrong`, а этот вариант — ПРАВИЛЬНЫЙ ответ
#        (correct == 0), потому что вопрос спрашивает про ловушку. Дидактика
#        требует, чтобы верный ответ звучал как заблуждение.
#     Поэтому у веток про destino стоит `(?<!«)`: запрещённая формулировка внутри
#     кавычек — это её называние, а не утверждение. Ограничение приёма честно:
#     lookbehind фиксирован, так что защищено только начало цитаты.
#   * `\btarde\s+o\s+temprano\b` — 1 ложное: «cuando tiendes las cartas por tu
#     cuenta, caen como caen, y tarde o temprano saldrá una invertida» (m6l1) —
#     это про тасовку, а не про обещание блага. На картах ветка давала 0.
#     Выброшена целиком.
#   * ОСТАВЛЕНО КАК НАСТОЯЩЕЕ — 2 срабатывания ветки «внешнее благо + en camino»:
#     m4l1.theory.es «el esfuerzo ya se hizo, los resultados VIENEN EN CAMINO» и
#     m4l1.q5_explain.es «los resultados ya vienen en camino».
#     ⚠️ Перевод здесь ВЕРЕН: русский оригинал говорит ровно «усилия сделаны,
#        результаты в пути». То есть рамка предсказания стоит в самом каноне, и
#        находка адресована автору русского текста, а не переводчику.
#
# ИТОГ КАЛИБРОВКИ: карты — 0 срабатываний; курс — 2 срабатывания, оба настоящие
# и оба про один и тот же оборот «los resultados vienen en camino» (m4l1).
PREDICTION_ES = (
    r"\b(?:la|esta|una|esa)\s+carta\s+(?!no\b)(?:\w+\s+){0,1}"
    r"(?:promete|asegura|garantiza|predice|augura|vaticina|pronostica)\b|"
    r"\bte\s+(?:espera|esperan|aguarda|aguardan)\b|"
    # «el destino» только с глаголом распорядительности и не в кавычках «…»
    r"(?<!«)\bel\s+destino\s+(?:\w+\s+){0,2}"
    r"(?:decide|decidir[áa]|har[áa]|dir[áa]|elige|elegir[áa]|dispone|manda|quiere|"
    r"tiene\s+reservado|se\s+encarga)\b|"
    r"(?<!«)\ben\s+manos\s+del\s+destino\b|"
    r"(?<!«)\best[áa]\s+escrito\b|(?<!«)\bescrito\s+est[áa]\b|\bdestinad[oa]s?\s+a\b|"
    r"\bsin\s+duda\b|\bten\s+por\s+seguro\b|\bcon\s+toda\s+seguridad\b|\bde\s+seguro\b|"
    r"\bseguramente\b|\binevitablemente\b|\bineludible\w*|"
    r"\bes\s+cuesti[óo]n\s+de\s+tiempo\b|"
    r"\bse\s+(?:cumplir[áa]|har[áa]\s+realidad|volver[áa]\s+realidad)\b|"
    r"\bpredicci[óo]n\s+(?:exacta|segura|certera|cerrada|del\s+futuro)\b|"
    r"\badivinar\s+el\s+futuro\b|\bbuen\s+augurio\b|"
    # конкретное внешнее благо + глагол прихода (оба порядка слов)
    r"\b(?:el\s+dinero|el\s+amor|el\s+[ée]xito|la\s+suerte|la\s+fortuna|la\s+abundancia|"
    r"la\s+prosperidad|el\s+reconocimiento|la\s+ayuda|la\s+recompensa|las\s+respuestas?|"
    r"los\s+resultados?|los\s+ingresos?)\s+(?:\w+\s+){0,2}"
    r"(?:llegar[áa]n?|vendr[áa]n?|volver[áa]n?|regresar[áa]n?|aparecer[áa]n?|"
    r"est[áa]n?\s+en\s+camino|vienen?\s+en\s+camino)\b|"
    r"\b(?:llegar[áa]n?|vendr[áa]n?|aparecer[áa]n?)\s+(?:el|la|los|las|un|una)\s+"
    r"(?:dinero|amor|[ée]xito|suerte|fortuna|abundancia|prosperidad|reconocimiento|"
    r"ayuda|recompensa|respuestas?|resultados?|ingresos?)\b|"
    # обещание достижения читателю
    r"\b(?:encontrar[áa]s|conseguir[áa]s|obtendr[áa]s|lograr[áa]s|recibir[áa]s|"
    r"hallar[áa]s|conocer[áa]s|alcanzar[áa]s|construir[áa]s)\b|"
    r"\bte\s+(?:conceder[áa]|regalar[áa]|recompensar[áa]|premiar[áa])\b|"
    r"\bte\s+(?:lo\s+)?agradecer[áa]\b|\bte\s+dar[áa]\s+las\s+gracias\b"
)

# --- 2. JARGON ----------------------------------------------------------------
#
# Эзотерический жаргон: вибрации, энергия вселенной, высшие силы, карма, астрал,
# чакры, аура, тонкий план, «закон притяжения», магические практики.
#
# ⚠️ ГЛАВНАЯ ЛОВУШКА ИСПАНСКОГО — «energía». Задание предупреждало, замер подтвердил:
#   голое `energ[íi]a` даёт 52 находки, настоящих 0. Это опорное слово блоков health
#   и general («Energía tranquila y pareja», «la energía va en olas», «qué te quita
#   más energía de la que te da», «Como energía, es una mudanza…» — жанровая формула
#   Младших арканов, 12 раз). Ловим только связки: energía del universo / cósmica /
#   divina / negativa, limpieza energética, cargar la energía. Их в корпусе 0.
#
# ⚠️ ЧТО ЕЩЁ ОТБРОСИЛ, С ЧИСЛАМИ (блок symbolism законно описывает иконографию RWS,
#   и это отдельный крупный источник шума, которого в русском словаре нет):
#   * `espíritu` — 12 находок, все ложные и 8 из них в symbolism («cuerpo, alma y
#     espíritu» у Иерофанта, «el fuego purificador del espíritu» у Торре).
#   * `[áa]ngel` — 4 находки, все ложные: ангел Умеренности, ангел Влюблённых,
#     ангел из четырёх фигур Мира, ангелы на чаше Королевы Кубков. Берём только
#     «ángel de la guarda» / «guía espiritual» (0 находок).
#   * `alma` — 10 находок, все ложные («el dolor del alma también se siente en el
#     cuerpo», «el alma antes de su viaje»). Выброшено.
#   * `signo|zodiac` — 7 находок, все ложные: знаки Овна/Козерога/Тельца на тронах
#     и «signos del zodiaco» на покрывале Espadas 9 — это описание рисунка.
#   * `ritual` — 8 находок, все ложные и все бытовые («un ritual tranquilo antes de
#     dormir», «rescata un pequeño ritual conocido»). Выброшено.
#   * `intuición` — 17 находок, все законные: это ключевое слово Сакердотиссы и Луны.
#   * `magia|hechizo|amuleto` — 3 находки, все ложные и все в symbolism («alguien
#     hechizado por las fantasías», «el amuleto de pez» Короля Кубков).
#     Оставлены только «hechizo/amarre/mal de ojo/limpia espiritual» как термины.
#   * `divino` — 1 находка, ложная: «las letras ROTA/TARO con las del Nombre divino»
#     (иконография Колеса). Выброшено; оставлено «energía divina».
#   * `atraer|abundancia|prosperidad` — 18 находок, все законные («tu autosuficiencia
#     atrae», «la abundancia responde al agradecimiento»). Выброшено.
#
#   * `gu[íi]as? espiritual` — выброшено в редакции 3: на курсе даёт 1 ложное
#     срабатывание, «Un GUÍA ESPIRITUAL está sentado entre dos columnas» (m2l3) —
#     это описание Иерофанта, в русском оригинале там «Духовный наставник».
#     Осталось «ángel de la guarda» и «seres de luz» (по нулю на обоих корпусах).
#
# ИТОГ КАЛИБРОВКИ: карты — 0 срабатываний, курс — 0 срабатываний.
JARGON_ES = (
    r"\bvibraci(?:[óo]n|ones)\b|\bvibra\s+(?:alto|en\s+sinton[íi]a)\b|"
    r"\benerg[íi]a\s+(?:del\s+universo|c[óo]smica|divina|universal|sutil|negativa|"
    r"positiva|femenina|masculina)\b|\benerg[íi]as\s+(?:negativas|positivas|densas|sutiles)\b|"
    r"\blimpieza\s+energ[ée]tica\b|\bcargar\s+(?:tu\s+|la\s+)?energ[íi]a\b|"
    r"\bel\s+universo\s+(?:te|conspira|provee|escucha|responde|quiere)\b|"
    r"\bc[óo]smic[oa]s?\b|\bcosmos\b|"
    r"\bfuerzas?\s+superior\w*|\bpoderes?\s+superiores\b|\bseres?\s+de\s+luz\b|"
    r"\b[áa]ngel(?:es)?\s+de\s+la\s+guarda\b|"
    r"\bel\s+m[áa]s\s+all[áa]\b|"
    r"\bkarma\b|\bk[áa]rmic\w*|\bvidas?\s+pasadas?\b|\breencarnaci\w*|"
    r"\bastral\w*|\bplano\s+(?:astral|sutil)\b|\bcuerpo\s+(?:astral|sutil|et[ée]reo)\b|"
    r"\bchakras?\b|\baura\b|\baur[áa]tic\w*|\bkundalini\b|\bprana\b|\btercer\s+ojo\b|"
    r"\bley\s+de\s+(?:la\s+)?atracci[óo]n\b|\bmanifestar\s+(?:tu|el|la)\s+(?:abundancia|"
    r"realidad|deseo)\b|\bfrecuencia\s+(?:vibratoria|alta)\b|\bsincronicidad\w*|"
    r"\bmal\s+de\s+ojo\b|\bhechizos?\b|\bamarres?\s+(?:de\s+amor)\b|\blimpia\s+espiritual\b|"
    r"\bsahumerio\w*|\bp[ée]ndulo\b|\bvidente\b|\bvidencia\b|\bm[ée]dium\b|\bclarividen\w*"
)

# --- 3. MEDICINE --------------------------------------------------------------
#
# Медицинская рамка: диагноз, лечение, врач, таблетки, симптом, терапия, клиника.
# Блоки health / health_reversed говорят о самочувствии, а не о болезнях.
#
# ⚠️ ГРАНИЦЫ СЛОВ И ЛОВУШКИ ИСПАНСКОГО (задание просило проверить именно их):
#   * `malestar` — 0 находок, и это правильно: слово бытовое («недомогание,
#     дискомфорт»), в набор НЕ входит; в набор входит `enfermedad` (0 находок).
#     Обратная ловушка тоже проверена: `\bestar\b` без границ сидит внутри
#     «bienestar» — оно открывает 24 блока корпуса («Para tu bienestar…»), так что
#     любая ветка с «estar» обязана иметь \b (это выстрелило в GENDER, см. ниже).
#   * `an[áa]lisis` голым — 3 находки, все ложные и все про мышление, не про кровь
#     («Favorece la investigación, el análisis y el estudio», Сакердотисса; Ermitaño;
#     Espadas 1). Русский словарь ловит «анализ[ыов]» безопасно, испанский — нет.
#     Берём только «análisis de sangre / análisis clínicos».
#   * `cura` голым — ловит «Este día cura; permíteselo» (Estrella, day_card) и
#     «decidir si van a curarlas» (Copas 5) — душевное исцеление, законно, ровно как
#     разрешённое «исцеление» в русском словаре. Берём только «curar una enfermedad».
#   * `sanaci[óo]n` — 3 находки, все законные (Звезда: «la esperanza y la sanación
#     tranquila»). Выброшено.
#   * `ansiedad|insomnio` — 4 находки, все законные и жанровые: это ключевые слова
#     Espadas 9 («retrata la ansiedad y las noches sin dormir») и Луны. В русском
#     словаре «депресси» тоже вынесено не в MEDICINE, а в SEARCH_BANNED. Здесь
#     оставлено только клиническое `depresi[óo]n` (0 находок).
#   * `dolor` — 13 находок, все законные (Espadas 3 — карта душевной боли).
#   * `cuerpo` — 40 находок, все законные, это опорное слово блока health.
#   * `receta` голым — в испанском это ещё и кулинарный рецепт; берём
#     «receta médica». `operación` голым — финансовая операция; берём «operación
#     quirúrgica». Обе ветки — 0 находок, но ловушка задокументирована.
#   * `presi[óo]n\s+(?:alta|baja)` пришлось выбросить (редакция 2): на прошлой
#     версии корпуса это давало ложное «la presi[óo]n BAJA cuando pides ayuda»
#     (p05.finances_reversed) — «baja» там глагол, а не «низкое давление».
#     Остались только однозначные «presión/tensión arterial» и «hipertensión».
#   * `profesional` — 4 находки, все про работу («un mentor, un padrino
#     profesional»); в набор не входит.
#
# ИТОГ КАЛИБРОВКИ: 0 находок на 958 блоках.
MEDICINE_ES = (
    r"\bdiagn[óo]stic\w*|\bdiagnostic(?:ar|a|an)\w*|"
    r"\btratamiento\w*|\btratar(?:se)?\s+(?:una|la|el|un)\s+(?:enfermedad|dolencia|patolog)\w*|"
    r"\bm[ée]dic[oa]s?\b|\bdoctor(?:a|es|as)?\b|\bpsiquiatr\w*|\bpsic[óo]log\w*|"
    r"\bterapeuta\w*|\bterapias?\b|\bpsicoterap\w*|\bfisioterap\w*|"
    r"\bpastillas?\b|\bmedicament\w*|\bmedicina\s+(?:para|contra)\b|\bf[áa]rmac\w*|"
    r"\bp[íi]ldoras?\b|\bantibi[óo]tic\w*|\bsuplement\w*|\bvitaminas?\b|"
    r"\breceta\s+m[ée]dica\b|\bs[íi]ntomas?\b|\benfermedad(?:es)?\b|\benferm[oa]s?\b|"
    r"\bdolencias?\b|\bpatolog[íi]\w*|\bcl[íi]nicas?\b|\bhospital(?:es)?\b|"
    r"\bconsultorio\w*|\bconsulta\s+m[ée]dica\b|\bcirug[íi]a\w*|"
    r"\boperaci[óo]n\s+quir[úu]rgica\b|"
    r"\bpresi[óo]n\s+arterial\b|\btensi[óo]n\s+arterial\b|"
    r"\ban[áa]lisis\s+(?:de\s+sangre|cl[íi]nic)\w*|\bex[áa]men(?:es)?\s+m[ée]dic\w*|"
    r"\bchequeo\s+m[ée]dic\w*|\bestudios?\s+m[ée]dic\w*|"
    r"\bdepresi[óo]n\b|\bdiabet\w*|\bhipertens\w*|\bcolesterol\b|\binsulina\b|"
    r"\bhormonal(?:es)?\b|\binfecci[óo]n(?:es)?\b|\bvirus\b|\bc[áa]ncer\b|\btumor(?:es)?\b|"
    r"\bcurar\s+(?:una|la)\s+(?:enfermedad|dolencia|infecci[óo]n)\b"
)

# --- 4. GENDER ----------------------------------------------------------------
#
# Род ЧИТАТЕЛЯ. Корпус обязан быть безродным: читатель может быть кем угодно.
#
# ⚠️ ПОЧЕМУ В ИСПАНСКОМ ЭТО УСТРОЕНО ИНАЧЕ, ЧЕМ В РУССКОМ.
#   В русском род читателя виден в глаголе («вы построили»→«построила») и ловится
#   по окончанию. В испанском глагол рода не несёт вообще — род вылезает ТОЛЬКО в
#   согласовании прилагательного/причастия. Поэтому ловить надо не прилагательное,
#   а ПОДЛЕЖАЩЕЕ: связку 2-го лица либо инфинитив с местоимением читателя рядом.
#   Замер, подтверждающий это:
#     * голое `honest[oa]` — 38 находок по одним Старшим, настоящих 0 (все — «una
#       conversación honesta», «una respuesta honesta»: род ПРЕДМЕТА).
#     * закрытый список ~70 «человеческих» прилагательных в женской форме по
#       Старшим — 38 находок, настоящих 6 (16%). Похоже, именно этот прогон дал
#       «около 33 мест» в предварительном обследовании: это сырьё ДО разбора.
#     * тот же список с якорем на подлежащее — 6 находок, настоящих 6.
#
# ⚠️ РЕДАКЦИЯ 2 (после первой приёмки). Первая редакция брала ЛЮБУЮ связку, включая
#   голый инфинитив, и потому ловила согласование с неодушевлённым подлежащим
#   женского рода — 2 ложных из 13:
#     «La PUERTA por la que pasabas de largo resulta estar ABIERTA» (p05.reversed)
#     «¿qué COSA de tu vida hace rato pide ser LLAMADA por su nombre?» (s13.health)
#   Разделил связки на два класса, и это чинит оба случая:
#     A. ЛИЧНАЯ форма 2-го лица (estás / sigues / quedas / te quedaste …) —
#        подлежащее заведомо читатель, якорь не нужен. На старом корпусе 4/4 без шума.
#     B. ИНФИНИТИВ (estar / ser / seguir / sentirte …) — сам по себе подлежащего не
#        называет, поэтому требует слева местоимение читателя: te / tú / ti / contigo
#        в пределах 60 знаков без пересечения границы предложения.
#   ⚠️ Якорь — именно `te|tú|ti|contigo`, и «tu» (притяжательное) в него НЕ входит:
#      с ним s13 «de TU vida … ser llamada» снова ложно срабатывает (проверено).
#   ⚠️ Якорь «любой глагол 2-го лица» тоже не годится: p05 содержит «pasabas»,
#      и ложное срабатывание возвращается (проверено).
#   ⚠️ Ветка B разделена по роду не из эстетики: женское прилагательное в испанском
#      слишком часто согласуется с изобилующими женскими существительными (puerta,
#      cosa, decisión, conversación), поэтому для женского рода якорь обязателен;
#      мужское причастие после инфинитива в этом корпусе почти всегда о читателе —
#      на старом корпусе ветка B-masc дала 1 находку и та настоящая
#      («esa sensación de estar ATADO por las circunstancias», s08.general).
#   Контроль: на СТАРОЙ версии корпуса новый набор ловит все 10 известных мест,
#   ложных 0 (было 2). На обновлённой версии — 0 срабатываний.
#
# ⚠️ ГРАНИЦЫ СЛОВ — ЭТО НЕ ФОРМАЛЬНОСТЬ, ЗДЕСЬ ОНИ СТОИЛИ 8 ЛОЖНЫХ СРАБАТЫВАНИЙ.
#   Первая редакция писала связки без \b и получила:
#     «apuestas arriesgadas» (est[áa]s), «respuestas honestas» (est[áa]s),
#     «contestar a una ofensa» (estar a), «Para tu bienestar recuerda / llega /
#     merecido / sostenido / económico / futuro» (estar ×6!), «quieres cercanía»
#     и «No esperes condiciones» (eres ×3). Все связки ниже обрамлены \b.
#   Отдельно: `\bs[ée]\b` («sé honesta») из списка убран — он ловит возвратное «se»
#   и дал 2 ложных («el ciclo se completa», «esa lista nunca se vacía») при 0
#   настоящих. Императив ловится веткой «hazte/ponte/siéntete/mantente».
#
# ⚠️ АКЦЕНТЫ. Первая редакция искала `vaci[oa]` и прошла мимо «quedas vacía»:
#   в испанском это «vacía». Все основы ниже пишутся как [íi]/[áa]/[óo].
#
# ⚠️ ЧТО ЕЩЁ ОТБРОСИЛ, С ЧИСЛАМИ:
#   * связка + ЛЮБОЕ следующее слово — 195 находок, настоящих 6 (3%). Утонуло.
#   * связка + герундий («estás construyendo», «Sigues apuntalando») — 40+ находок,
#     настоящих 0: герундий рода не несёт. Отсекается (?!\w*(?:ando|[ié]ndo)).
#   * `\bsol[oa]s?\b` голым — 134 находки, настоящих 2 (1.5%): 89 раз «solo» =
#     наречие «только», 18 раз безродное «a solas», плюс числительное «una sola
#     cosa/meta/vez» и «se acomodan solas» о предметах.
#     МУЖСКОЕ «solo» о читателе поймать без морфологии НЕЛЬЗЯ и мы не пытаемся:
#     ветка «глагол 2 л. или инфинитив + solo» дала 10 находок при 2 настоящих.
#     Ловим только женское `solas?` — 2 находки, 2 настоящих. Это осознанная дыра:
#     «te quedas solo» проверка пропустит, ищите глазами.
#   * `\bsola\b` с одними lookbehind'ами, без якоря на глагол — 5 находок, ложных 3
#     (60%, выше порога трети): «la idea madure sola», «tu autoridad ya se ve sola»,
#     «la rutina rueda sola» — 3-е лицо о неодушевлённом. С якорем «слово на -as/-es
#     (2 л. ед. ч.) или инфинитив» → 2/2.
#   * ветка «прилагательное + y + прилагательное» (расчёт был поймать второй член в
#     «abierta y genuina») — 3 находки, ложных 3 из 3 (100%): «el vínculo resulta
#     cálido y seguro», «un diálogo honesto y curioso», «alguien generoso y atento».
#     Удалена: у неё нет якоря на подлежащее — ровно та ошибка, от которой
#     предостерегает весь этот комментарий.
#   * `nosotros mismos` — 5 находок «nosotros», все родовой генерик и стилистически
#     нормальны; берём только маркированное `nosotras`.
#   * скобочные `\w+\(a\)`, `\w+/a`, `@` — 0 находок; ветка как защита от регресса.
#   * Род ПЕРСОНАЖЕЙ карт в набор не входит и не должен: «La Emperatriz»,
#     «es una mujer solar» (Reina de Bastos), «una mujer independiente» (Reina de
#     Espadas), «la eterna estudiante… curiosa, práctica, entusiasmada» (Sota de
#     Oros) — женский род законен, это фигура на карте. Ни одна ветка их не задевает.
#
# ⚠️ РЕДАКЦИЯ 3 (после прогона по ТЕКСТАМ КУРСА, content/course.json).
#   Курс объясняет, а не обращается к читателю, и вскрыл три класса, которых в
#   колоде просто не было. Первая редакция дала там 14 испанских срабатываний,
#   настоящих 0. Разбор и правки:
#   * «uno mismo» — БЕЗЛИЧНЫЙ оборот («сам с собой», «для себя»), а не род читателя:
#     7 ложных — «búsqueda de uno mismo» (m3l1), «escucharse a uno mismo»
#     (m3l1.q3_opt3), «honestidad con uno mismo» (m4l5), «leer para uno mismo»
#     (m6l3 ×4). В колоде карт он не встречается ни разу, поэтому и не всплыл.
#     Убран целиком.
#   * «una misma» в значении «ОДИН И ТОТ ЖЕ» — 4 ложных: «dentro de una misma vida»
#     (m3l2), «una misma escalera de números» (m4l1), «continúan una misma historia»
#     (m6l2), «cómo una misma situación cambia con el tiempo» (m6l2.q1_explain).
#     Это самый коварный класс: форма буквально та же, что у «сама по себе».
#     Убран целиком; остались только «tú mismo/misma» и «ti mismo/misma».
#   * «solas» во МНОЖЕСТВЕННОМ числе — 1 ложное: «las figuras … acostumbradas a
#     arreglárselas SOLAS» (m4l7), где женский род относится к фигурам на картах.
#     Исключение через lookahead его не снимало — понадобился принципиальный якорь:
#     читатель всегда «tú», значит «solas» о нём быть не может. Ветка сужена до
#     единственного числа; обе настоящие находки в колоде («actuar sola»,
#     «resuelves todo sola») единственного числа и по-прежнему ловятся.
#   * возвратный инфинитив «quedarse trabado» — 1 ложное (m4l6): согласование там
#     с «el Ocho», то есть с КАРТОЙ. Из ветки B2 убраны все инфинитивы на -se:
#     в испанском они безличны, а к читателю обращаются формы на -te. Настоящая
#     находка колоды «esa sensación de ESTAR ATADO» (s08.general) не задета.
#
# ИТОГ КАЛИБРОВКИ: карты (обновлённые) — 0 срабатываний, все 10 мест исправлены;
# карты (старая версия) — 10 срабатываний = 10 известных мест, ложных 0;
# курс — 0 срабатываний.

# A. Личные формы 2-го лица: подлежащее заведомо читатель.
_COP_FIN_ES = (
    r"(?:\best[áa]s\b|\best[ée]s\b|\bestabas\b|\bestuviste\b|\beres\b|\bseas\b|\bfuiste\b|"
    r"\bsigues\b|\bquedas\b|\bquedaste\b|\bte\s+quedas\b|\bte\s+quedaste\b|"
    r"\bte\s+sientes\b|\bte\s+sientas\b|\bte\s+ves\b|\bte\s+veas\b|\bte\s+vuelves\b|"
    r"\bte\s+notas\b|\bte\s+descubres\b|\bandas\b|"
    r"\bqu[ée]date\b|\bmantente\b|\bponte\b|\bsi[ée]ntete\b|\bmu[ée]strate\b|\bhazte\b)"
)
# B. Инфинитивы: подлежащего не называют, требуют якоря на читателя.
# ⚠️ Возвратные инфинитивы на -se (sentirse, quedarse, verse) сюда НЕ входят:
# в испанском это безличная форма («quedarse trabado» = «застревание вообще»),
# а к читателю обращаются формы на -te. Проверено на курсе, см. комментарий выше.
_COP_INF_ES = (
    r"(?:\bsentirte\b|\bquedarte\b|\bverte\b|\bvolverte\b|\bhacerte\b|"
    r"\bestar\b|\bser\b|\bseguir\b)"
)
# Местоимение читателя слева, в пределах одного предложения.
# ⚠️ Притяжательное «tu» сюда не входит намеренно, см. комментарий выше.
_YOU_ES = r"(?:\bte\b|\btú\b|\bti\b|\bcontigo\b)[^.;:!?¿¡]{0,60}?"
_MOD_ES = (
    r"(?:\s+(?:muy|m[áa]s|tan|ya|todav[íi]a|un\s+poco|algo|medio|bastante|"
    r"demasiad[oa]|siempre|a\s+veces|realmente))*"
)
# «Человеческие» состояния: список закрытый намеренно — открытое «любое слово
# на -o/-a» даёт 195 срабатываний при 6 настоящих.
_ADJ_ES = (
    r"(?:orgullos|vac[íi]|content|trist|nervios|ansios|segur|insegur|tranquil|calm|"
    r"list|preparad|dispuest|abiert|cerrad|complet|plen|quiet|inquiet|solitari|"
    r"invisibl|culpabl|honest|sincer|genuin|aut[ée]ntic|generos|ego[íi]st|hart|"
    r"satisfech|desbordad|desgastad|quemad|enferm|herid|sanad|recuperad|rot|"
    r"fri|c[áa]lid|dur|maduro|torp|creativ|curios|atent|distra[íi]d|confundid|clar)"
)
_NOGER = r"(?!\w*(?:ando|[ié]ndo))"

GENDER_ES = [
    # A1. Личная связка + ПРИЧАСТИЕ (не герундий): «sigues atascada»,
    #     «te quedaste trabada». \w{2,}, а не {3,}: с {3,} проверка проходила мимо
    #     «atado» (в основе всего две буквы).
    _COP_FIN_ES + _MOD_ES + r"\s+" + _NOGER + r"\w{2,}(?:ad|id)[oa]\b",
    # A2. Личная связка + прилагательное состояния: «quedas vacía»,
    #     «estás orgullosa».
    _COP_FIN_ES + _MOD_ES + r"\s+" + _ADJ_ES + r"[oa]\b",
    # B1. Инфинитив + ЖЕНСКАЯ форма, но только с местоимением читателя слева:
    #     «te invita a estar abierta y ser genuina».
    #     Без якоря сюда попадали «la puerta resulta estar abierta» и
    #     «qué cosa … pide ser llamada» — оба про предмет.
    _YOU_ES + _COP_INF_ES + _MOD_ES + r"\s+" + _NOGER +
    r"(?:\w{2,}(?:ad|id)a|" + _ADJ_ES + r"a)\b",
    # B2. Инфинитив + МУЖСКОЕ причастие: «esa sensación de estar atado».
    #     Якорь не нужен: на старом корпусе ветка дала 1 находку и та настоящая.
    _COP_INF_ES + _MOD_ES + r"\s+" + _NOGER + r"\w{2,}(?:ad|id)o\b",
    # C. «sola» о читателе: якорь на 2 л. ед. ч. (-as/-es) или инфинитив;
    #    хвостовой lookahead снимает числительное «una sola cosa/vez/…».
    #    ⚠️ Только ЕДИНСТВЕННОЕ число: читатель всегда «tú», поэтому «solas» о нём
    #    быть не может — зато бывает о картах («acostumbradas a arreglárselas
    #    solas», m4l7 курса). Множественное убрано в редакции 3.
    r"\b(?:\w+(?:as|es)|\w+(?:ar|er|ir))\b"
    r"(?:\s+(?:todo|todos|siempre|casi|ya|aqu[íi]|as[íi]|m[áa]s))?\s+sola\b"
    r"(?!\s+(?:cosa|meta|vez|direcci[óo]n|l[íi]nea|fuente|acci[óo]n|afici[óo]n|regla|"
    r"tarea|pausa|maniobra|pregunta|frase|parte|palabra|idea|persona|salida|manera|"
    r"forma|raz[óo]n|d[íi]a|ritual))",
    # D. Усилительное местоимение о читателе: только «tú/ti mismo/misma».
    #    ⚠️ «uno mismo» и «una misma» убраны в редакции 3 — см. комментарий выше:
    #    первое безлично, второе почти всегда значит «один и тот же».
    #    «nosotros» — родовой генерик, берём только маркированное «nosotras».
    r"\b(?:t[uú]|ti)\s+mism[oa]\b|\bnosotras\b",
    # E. Скобочные и слэшевые «-o/a» формы (в корпусе 0, защита от регресса).
    r"\w+\([oa]\)|\w+/[oa]\b|\b[oa]/[oa]\b|\w+[oa]@\b|\bl[oa]s/",
    # F. Гендерная роль, приписанная читателю (в корпусе 0).
    r"\bcomo\s+(?:mujer|hombre|madre|padre|hija|hijo|esposa|esposo|jefa|jefe)\b|"
    r"\beres\s+de\s+l[ao]s\s+que\b|\bquerid[oa],",
]

# --- 5. GLOSSARY --------------------------------------------------------------
#
# КАНОН (из cards.json, name.es):
#   масти: Bastos, Copas, Espadas, Oros
#   двор:  Sota, Caballero, Reina, Rey
#   Старшие: El Loco, El Mago, La Suma Sacerdotisa, La Emperatriz, El Emperador,
#     El Hierofante, Los Enamorados, El Carro, La Fuerza, El Ermitaño,
#     La Rueda de la Fortuna, La Justicia, El Colgado, La Muerte, La Templanza,
#     El Diablo, La Torre, La Estrella, La Luna, El Sol, El Juicio, El Mundo.
#
# ⚠️ РЕДАКЦИЯ 2. Первая редакция исходила из гипотезы «канон = Oros, значит любое
#   moneda/vara/pentáculo — нарушение» и давала 15 срабатываний. Редактор-носитель
#   решил иначе, и решение принято:
#       «pentáculo» — СИМВОЛ, «moneda» — ПРЕДМЕТ, «Oros» — НАЗВАНИЕ МАСТИ И КАРТ.
#   Русский и английский эти три слова различают («пентакль» / «монета» /
#   «Пентакли»; «pentacle» / «coin» / «Pentacles»), перевод обязан различать тоже.
#   После правки корпуса старая регулярка давала 12 срабатываний, все ложные, —
#   она ловила ровно то, что стало нормой. Переписано под фактическое правило:
#   нарушение — это когда слово стоит в позиции ИМЕНИ МАСТИ ИЛИ КАРТЫ, а не когда
#   им назван предмет на картинке. Это тот же приём, что в русском словаре про
#   «чашу как предмет»: ищем не слово, а его синтаксическую позицию —
#   «<ранг> de <масть>» и «palo/naipe/baraja de <масть>».
#
# ⚠️ ЧТО ТЕПЕРЬ ЗАКОННО И В СЛОВАРЬ НЕ ВХОДИТ (проверено на обновлённом корпусе):
#   * `pent[áa]culos?` — 9 вхождений, все законные: символ на рисунке
#     («El pentáculo dorado, con su estrella de cinco puntas»), ровно как «пентакль»
#     в русском оригинале тех же блоков.
#   * `monedas?` — 7 вхождений, все законные: предмет («Las dos monedas bajo sus
#     pies», «las nueve monedas» — в русском там же «девять монет»).
#   * `bastones?` — 11 вхождений, все в symbolism мастей Bastos и все про предмет
#     («Cuatro bastones coronados por una guirnalda»).
#   * `varas?` — 6 вхождений, все законные: жезл Колесницы, «vara de medir»,
#     «con la misma vara que usas», а в w08/world это перевод русских «древки» и
#     «два жезла» — предмет, не масть. (Стилистическая неровность «bastones» и
#     «varas» в одном абзаце w08.symbolism осталась, но это вычитка, не глоссарий.)
#   * `sacerdotisa` без «Suma» — 2 вхождения (high-priestess.symbolism,
#     justice.symbolism). НЕ нарушение: русский в этих же местах пишет сокращённо
#     «Жрица», английский — «The Priestess». Перевод следует оригиналу. Убрано.
#   * `la rueda` — 9 вхождений: сокращение канона, идиома «reinventar la rueda»
#     и колесо на рисунке. Все законные, выброшено.
#   * `palo/palos` — 3 вхождения, все законные: «palo» по-испански и есть «масть»
#     («la única carta del palo sin personas»). Поэтому ловим не слово «palo»,
#     а конструкцию «palo de <неканоническая масть>».
#   * `caballo|jinete` — 10 вхождений, все про коня и всадника на рисунке.
#   * `fortaleza` — 3 вхождения, все бытовые («una prisión que se confundía con una
#     fortaleza», «hoy esa es tu fortaleza», «la casa como fortaleza»), поэтому
#     ветка сужена до «la Fortaleza» как имени карты (0 срабатываний).
#   * `Waite` — 7 вхождений, законная ссылка на источник; запрещено, как в
#     русско-английском словаре, только издание «Rider-Waite» (0 срабатываний).
#
# ⚠️ ОБРАТНОЕ НАПРАВЛЕНИЕ (ветка 4) — то, что у правки осталось недоделанным.
#   Правило работает в обе стороны: раз «Oros» — имя масти и карт, то называть им
#   СИМВОЛ на рисунке тоже нельзя. Правка ввела «pentáculo» в семь блоков symbolism
#   (p01–p04, p06–p08), но шесть остались на старом слове, и русский/английский в
#   этих же местах говорят «пентакль»/«pentacle»:
#     p05 «cinco oros»  ← ru «пятью пентаклями»
#     p10 «Los diez oros» ← ru «Десять пентаклей»
#     p11 «el oro que flota» ← ru «пентакль, который парит»
#     p12 «sostiene el oro» ← ru «держит пентакль»
#     p13 «el oro que sostiene» ← ru «смотрит на пентакль»
#     p14 «el cetro y el oro» ← ru «Скипетр и пентакль»
#   Ветка ловит «<артикль/числительное> + oro(s)» и отсекает имена карт lookbehind'ом
#   на «de » («el As de Oros», «Ocho de Oros» — 31 вхождение, ни одно не задето).
#   ⚠️ Известная цена: «el oro» в значении «золото как металл» ветка поймает.
#      В текущем корпусе таких мест 0; если появятся — сужать по соседям, а не
#      снимать ветку.
#
# ИТОГ КАЛИБРОВКИ НА ОБНОВЛЁННОМ КОРПУСЕ: 6 срабатываний, ложных 0 (все шесть —
# ветка 4). Ветки 1–3 и 5–6 дают 0: неканонических имён мастей и карт в корпусе нет.

# Неканонические имена мастей — общий кусок для позиций «имя карты» и «имя масти».
_BAD_SUIT_ES = (
    r"(?:monedas|varas|palos|bastones|cetros|pent[áa]culos|discos|denarios|"
    r"c[áa]lices|vasos|sables|corazones|tr[ée]boles|picas|diamantes)"
)

GLOSSARY_ES = (
    # 1. Имя КАРТЫ: «<ранг> de <неканоническая масть>» — «Dos de Monedas».
    r"\b(?:as|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|sota|caballero|"
    r"reina|rey|paje|princesa|pr[íi]ncipe|doncella|valet|dama)\s+de\s+"
    + _BAD_SUIT_ES + r"\b|"
    # 2. Имя МАСТИ: «palo/naipe/baraja/arcanos menores de <неканоническая масть>».
    r"\b(?:palo|palos|naipe|naipes|baraja|arcanos?\s+menor(?:es)?)\s+de\s+"
    r"(?:l[oa]s\s+)?" + _BAD_SUIT_ES + r"\b|"
    # 3. Неканонический чин двора при канонической масти: «Paje de Oros».
    r"\b(?:paje|doncella|princesa|pr[íi]ncipe|valet|dama)\s+de\s+"
    r"(?:bastos|copas|espadas|oros)\b|"
    # 4. Обратное направление: именем масти назван символ на рисунке.
    r"(?<!\bde\s)\b(?:un|una|el|los|las|dos|tres|cuatro|cinco|seis|siete|ocho|"
    r"nueve|diez|varios|sendos|sus)\s+oros?\b|"
    # 5. Неканонические имена Старших. «La Sacerdotisa» и «la Rueda» сюда НЕ входят:
    #    русский оригинал в тех же местах тоже сокращает.
    r"\bla\s+papisa\b|\bel\s+sumo\s+sacerdote\b|\bel\s+papa\b|\bel\s+buf[óo]n\b|"
    r"\bel\s+necio\b|\bel\s+tonto\b|\bel\s+ahorcado\b|\bla\s+fortaleza\b|"
    r"\bel\s+eremita\b|\blos\s+amantes\b|\bel\s+enamorado\b|\bla\s+carroza\b|"
    r"\bla\s+temperancia\b|\bel\s+juicio\s+final\b|\bel\s+arcano\s+sin\s+nombre\b|"
    # 6. Издание.
    r"\brider[\s-]?waite\b|\brider\b"
)


# --- что реально нашлось в корпусе после калибровки ---------------------------
FINDINGS = {
    # Прогон по двум корпусам одним и тем же словарём:
    #   карты — content/cards.json, 958 испанских блоков;
    #   курс  — content/course.json, 32 урока + 160 вопросов
    #           (`check_canon.py --scope course`, испанская часть — 832 блока).
    # Итог: карты 0 / 0 / 0 / 0 / 0, курс 0 / 0 / — / 2 / 0
    #        (prediction / jargon / medicine / … см. ниже).

    # КАРТЫ: 0. КУРС: 2 срабатывания, ОБА НАСТОЯЩИЕ — и оба про один оборот.
    # ⚠️ Находка адресована КАНОНУ, а не переводу: русский оригинал говорит ровно
    #    «усилия сделаны, результаты в пути», то есть рамка предсказания стоит
    #    в исходном тексте, и испанский её честно воспроизводит.
    "prediction": [
        ("m4l1.theory.es",
         "El Tres de Bastos: … el esfuerzo ya se hizo, los resultados VIENEN EN CAMINO "
         "(ru: «усилия сделаны, результаты в пути»)"),
        ("m4l1.q5_explain.es",
         "…la figura mira cómo sus planes navegan hacia la meta: los resultados ya "
         "VIENEN EN CAMINO (ru: то же самое)"),
    ],

    # КАРТЫ: 0. КУРС: 0. Эзотерического жаргона нет ни там, ни там.
    # «energía» (52 на картах) — жанровое слово блока health; «espíritu»/«ángel»/
    # «signo» — иконография symbolism; «guía espiritual» (m2l3) — Иерофант.
    "jargon": [],

    # КАРТЫ: 0. КУРС: проверка туда не ходит — check_4_medicine объявлена
    # in_course=False и ограничена HEALTH_BLOCKS, которых у уроков нет.
    # ⚠️ И это правильно: урок этики m1l4 весь построен на «таро не заменяет врача
    #    и психотерапевта» — при прогоне вручную словарь даёт там 11 срабатываний,
    #    все законные. Медицинскую лексику в курсе запрещать нельзя, там она и есть
    #    предмет разговора; сужать под это MEDICINE_ES не нужно, достаточно не
    #    включать проверку в course-scope.
    "medicine": [],

    # КАРТЫ: 0 — все 10 мест исправлены редакцией. КУРС: 0.
    # Для истории — что нашла первая волна на картах и как это выглядит сейчас
    # (проверено диффом со старой версией
    #  /mnt/user-data/uploads/my-projects/arcanum/content/cards.json):
    #   lovers.health            «quedas VACÍA»            → «te quedas en el vacío»
    #   lovers.finances_reversed «actuar SOLA»             → «actuar por separado»
    #   hermit.career_reversed   «resuelves todo SOLA»     → «resuelves todo por tu cuenta»
    #   justice.finances_rev.    «Revisa las cuentas TÚ MISMA» → «Revisa tú las cuentas»
    #   hanged-man.career_rev.   «sigues ATASCADA»         → «sigues en punto muerto»
    #   devil.general            «elegida por NOSOTRAS MISMAS» → «que elegimos por cuenta propia»
    #   star.general             «estar ABIERTA y ser GENUINA» → «a la apertura y la sinceridad»
    #   sun.career_reversed      «estás ORGULLOSA»         → «un resultado que te enorgullece»
    #   world.career_reversed    «te quedaste TRABADA»     → «te frenaste»
    #   s08.general              «estar ATADO»             → «tener las manos atadas»
    # Регрессионный контроль редакции 3: прогон текущего словаря по СТАРОЙ версии
    # карт даёт ровно 10 срабатываний = те же 10 мест, ложных 0.
    "gender": [],

    # КАРТЫ: 0 — шесть мест, где именем масти «Oros» был назван символ на рисунке,
    # исправлены на «pentáculo» (p05, p10, p11, p12, p13, p14 symbolism), как и три
    # таких же места в курсе. КУРС: 0.
    # Регрессионный контроль: по СТАРОЙ версии карт словарь даёт 9 срабатываний —
    # те самые шесть плюс p06/p07/p08, поправленные первой волной.
    "glossary": [],
}
