# -*- coding: utf-8 -*-
"""Словари португальских проверок канона (аналог PREDICTION/JARGON/MEDICINE/GENDER/GLOSSARY
из scripts/check_canon.py, языки ru/en).

Калиброваны на живом корпусе: content/cards.json, 78 карт × 13 блоков = 958 непустых
португальских блоков (у 22 Старших есть birth_path, у Младших нет — отсюда 958, а не 1014).
Все регулярки применяются с re.IGNORECASE, кроме отмеченных (в GLOSSARY_PT часть веток
опирается на заглавную букву, но и в нижнем регистре они дают 0 ложных — проверено).

Метод калибровки везде одинаковый: широкая редакция → просмотр ВСЕХ находок глазами →
сужение, если ложных больше трети. Числа в комментариях — реальные замеры по этим 958
блокам, а не оценки. Проверки, давшие ноль, оставлены с «сторожевыми» ветками: корпус
чистый сегодня, но правка завтра может внести ровно ту форму, которую ветка ждёт.

ВТОРАЯ ВОЛНА КАЛИБРОВКИ (курс, `--scope course`): те же словари прогнаны по
content/course.json — 32 урока теории и 160 вопросов викторины, 832 непустых
португальских блока (theory + q/q_explain/q_opt по псевдокарточной схеме
load_course_units). Курс — ДРУГОЙ ЖАНР: он объясняет карты и рассуждает о методе,
а не обращается к читателю, поэтому дал 12+2+1+1 ложных срабатываний. Правки второй
волны помечены ниже как «КУРС:». Ни одна из них не ослабила проверку на колоде:
регрессия гоняется по предыдущей версии карт (15 родовых находок + 1 глоссарийная,
все ловятся после правок; в текущей исправленной колоде — 0).

ТРИ ЖАНРОВЫХ РАЗЛИЧИЯ, ИЗ КОТОРЫХ ВЫРОСЛИ ВСЕ ПРАВКИ ВТОРОЙ ВОЛНЫ:
  1. Курс ЦИТИРУЕТ запрещённые формулировки, чтобы их разобрать («A opção “com certeza
     a seu favor” é justamente a armadilha»). Названная формулировка — не утверждение.
  2. Курс ОПИСЫВАЕТ рисунок и персонажей («uma mulher está amarrada», «duas pessoas
     acostumadas a se virar sozinhas»), и род там принадлежит персонажу, а не читателю.
  3. Курс говорит О ТЕМЕ карт в третьем лице («as duas cartas falam de ficar sozinho»)
     и безлично об умении («ler para si mesmo»), а колода говорит читателю «você».
"""

# --- 1. PREDICTION ------------------------------------------------------------
#
# Рамка предсказания: обещает КАРТА или обещано внешнее благо. Итог калибровки: 0 находок,
# корпус на этой проверке чист. Что пробовалось и отброшено (замеры по 958 блокам):
#
# ⚠️ ШИРОКОЕ БУДУЩЕЕ НЕ БЕРЁМ — это замер, а не осторожность. «vai» даёт 45 находок,
#    «vão» — 15, синтетический футурум (\w+r[áã]o?) — 26. Просмотрены все 86: настоящих
#    дефектов НОЛЬ. В португальском «vai» почти всегда либо прогрессив («a decisão vai
#    ficando para depois», «o peso vai afrouxando»), либо относительное придаточное
#    («para onde você vai»), либо про предмет («o dinheiro vem e vai em ondas»). Футурум
#    же в этом корпусе почти не встречается как футурум: из 26 «находок» 12 — это вообще
#    другие слова, попавшие под \w+r[áã]o (padrão, extremos, clarão, Torá), а остальные —
#    инфинитив с клитикой (tirá-las, quebrá-lo, encerrá-la). Ловим не время глагола,
#    а обещание внешнего блага.
# ⚠️ ГОЛОЕ «promete» ОТБРОШЕНО: 12 находок, из них 5 — законное отрицание («A carta não
#    promete prêmios/quantias altas/lucro imediato/salto nenhum» — это СНЯТИЕ рамки),
#    4 — про людей («quem promete muito e entrega pouco», «encanta e some, promete e não
#    cumpre»), 3 — про изображение на карте (c07.symbolism: «o rosto promete amor, o
#    castelo promete sucesso» — семь кубков и есть карта иллюзий). Настоящих 0.
#    Поэтому «promete» берём только с подлежащим «carta» или с адресатом «a você».
# ⚠️ ГОЛОЕ «espera» ОТБРОШЕНО: 19 находок, все законные — существительное «ожидание»
#    («a espera se arrasta», «compasso de espera», «à espera da colheita») или императив
#    («espere um dia antes de decidir» — это как раз совет, а не предсказание). Ловим
#    только «espera por você» / «aguarda você», где ждёт ВАС внешнее благо.
# ⚠️ ГОЛОЕ «destino» ОТБРОШЕНО: 2 находки, обе законные — «destino e providência unidos»
#    в symbolism Колеса (описание рисунка) и «quando tem um destino» = «пункт назначения»
#    (w14.health). Нужен «o destino» + глагол распоряжения.
# ⚠️ «sem falta» УБРАНО из набора «показателей неизбежности»: единственная находка
#    (p13.day_card «faça sem falta algo só para si») — усилитель при ИМПЕРАТИВЕ, то есть
#    ровно противоположность предсказанию.
# ⚠️ КЛАСС «внешнее благо + приходит» пришлось ограничить будущим временем: в настоящем
#    он даёт 27 находок, и все 27 — жанровая норма («o reconhecimento vem por mérito»,
#    «o dinheiro chega como reconhecimento do que você fez», «o amor chega a uma vida
#    cheia»). Португальское настоящее здесь родовое, а не пророческое; дефект появляется,
#    когда то же самое сказано будущим («o dinheiro vai voltar»), — эту форму и ловим.
# Проверено синтетикой: «A carta não promete prêmios» — не ловится; «A carta promete amor»,
# «O dinheiro vai voltar», «você vai conseguir», «com certeza vai chegar», «o destino decide»,
# «espera por você» — ловятся.
#
# КУРС (2 срабатывания, оба ложные, оба вылечены одним guard'ом):
#   m3l2.theory.pt «“o destino decide tudo” não é a conclusão desta carta, e sim a armadilha
#     dela» — урок Колеса ровно про то, что пассивность и есть ловушка карты;
#   m6l4.q5_explain.pt «A opção “com certeza a seu favor” é justamente a armadilha da
#     previsão» — пояснение НАЗЫВАЕТ неверный вариант ответа.
# В обоих случаях запрещённая формулировка стоит в кавычках-ёлочках, потому что её
# разбирают, а не утверждают. Отсюда общий lookbehind перед всей альтернативой: находка,
# начинающаяся сразу после открывающей кавычки, не считается. Guard узкий намеренно —
# он смотрит ровно на один символ слева и не гасит запрещённую формулировку, которая
# просто стоит внутри длинной цитаты.
# ⚠️ Дистракторы викторины («A crise com certeza não vai acontecer», «tudo com certeza vai
#    acabar bem» — 4 штуки) под guard НЕ попадают и не должны: их снимает штатный
#    _without_distractors в check_2. Это и есть проверка чувствительности словаря —
#    он видит ровно ту рамку, которую урок учит распознавать.
PREDICTION_PT = (
    r"(?<![“\"«‘\'])(?:"
    r"\bcartas?\s+(?!n[ãa]o\b|nunca\b|jamais\b)"
    r"(?:promete|prometem|garante|garantem|assegura|anuncia|prev[êe]|adivinha)\b"
    r"|\bpromete\s+(?:a\s+voc[êe]|que\s+voc[êe])\b"
    r"|\bespera\s+por\s+voc[êe]\b|\baguarda\s+voc[êe]\b|\best[áa]\s+esperando\s+por\s+voc[êe]\b"
    r"|\bo\s+destino\s+(?:\w+\s+){0,2}"
    r"(?:decide|decidir[áa]|quer|reserva|escolhe|traz|leva|guarda|manda|cuida)\b"
    r"|\bpredestin\w*|\bprofetiz\w*|\bpredi[çz][ãa]\w*|\bpress[áa]gi\w*|\bvatic[íi]ni\w*"
    r"|\bcom certeza\b|\bcom toda a certeza\b|\bcertamente\b|\bfatalmente\b|\binevitavelmente\b"
    r"|\b(?:resultados?|reconhecimento|ajuda|respostas?|dinheiro|renda|sucesso|amor|lucro"
    r"|pr[êe]mios?|recompensa|abund[âa]ncia|prosperidade|felicidade)\b(?:\s+\w+){0,2}"
    r"\s+(?:vai|v[ãa]o|h[áa]\s+de|h[ãa]o\s+de)\s+(?:chegar|voltar|vir|aparecer|retornar|acontecer)\b"
    r"|\b(?:resultados?|reconhecimento|ajuda|respostas?|dinheiro|renda|sucesso|amor|lucro"
    r"|pr[êe]mios?|recompensa|abund[âa]ncia|prosperidade|felicidade)\b(?:\s+\w+){0,2}"
    r"\s+(?:chegar[áã]\w*|voltar[áã]\w*|vir[áã]\w*|aparecer[áã]\w*)\b"
    r"|\bvoc[êe]\s+(?:vai|ir[áá])\s+"
    r"(?:conseguir|conquistar|encontrar|receber|ganhar|alcan[çc]ar|construir|obter|realizar)\b"
    r"|\bvoc[êe]\s+(?:conseguir[áá]|encontrar[áá]|receber[áá]|ganhar[áá]|alcan[çc]ar[áá]"
    r"|conquistar[áá]|ter[áá])\b"
    r"|\btudo\s+(?:vai\s+dar\s+certo|dar[áá]\s+certo|vai\s+se\s+resolver|se\s+resolver[áá])\b"
    r"|\best[áa]\s+garantid\w+\b|\best[áa]\s+escrito\b"
    r"|\bem breve\b|\bmais cedo ou mais tarde\b|\bn[ãa]o\s+tarda\b"
    r")"
)

# --- 2. JARGON ----------------------------------------------------------------
#
# Эзотерический жаргон. Итог калибровки: 0 находок. Что пробовалось и отброшено:
#
# ⚠️ ГОЛОЕ «energia» — 62 находки, ВСЕ законные, и это главная ловушка португальского
#    словаря. В BR-PT «energia» — бытовое слово про силы и настрой: «a energia do dia»,
#    «energia não falta», «a energia se recompõe», «sem energia nenhuma», «a energia do
#    salto». Ни одного «energia do universo» / «energia negativa» / «limpar a energia»
#    в корпусе нет. Поэтому «energia» ловится только в связке.
# ⚠️ «alma» и «espírito» ОТБРОШЕНЫ: 30 находок вместе, все законные. «alma» здесь —
#    обычная метафора чувства («o peso na alma», «intimidade de alma», «um trabalho sem
#    alma»), «espírito» — либо описание рисунка Уэйта в symbolism («a matéria acima do
#    espírito»), либо идиома «jovem de espírito». Эзотерики в них нет.
# ⚠️ «vibra» без хвоста ОТБРОШЕНО: поймало бы законное «vibrante». Ловим только
#    «vibração/vibrações» и «alta vibração».
# ⚠️ ГОЛОЕ «universo» ОТБРОШЕНО: в PT «o universo de/da X» = «сфера, мир чего-то»
#    («o universo do trabalho»), это законно. Нужен универсум-агент: «o universo conspira/
#    responde/manda», «peça ao universo», «energia do universo».
# ⚠️ «simpatia» ОТБРОШЕНО: в BR-PT это одновременно «народный приворот» И «приветливость».
#    Второе значение в тексте про рефлексию куда вероятнее — ветка съедала бы норму.
# ⚠️ «purificar», «divino», «sagrado» ОТБРОШЕНЫ по той же причине, что «espírito»: в
#    symbolism они описывают символику карты (Nome Divino на Колесе), а не учат читателя
#    чистить чакры.
# ⚠️ Границы слова обязательны у «aura» (иначе «restaurar», «aurora») и у «carma»
#    (иначе «encarnar» и опечаточные формы) — это португальский аналог английской
#    ловушки «illness» внутри «stillness».
JARGON_PT = (
    r"\bvibra[çc][ãõ]\w*|\balta\s+vibra|\bboa\s+vibe\b"
    r"|\benergia\s+(?:do\s+universo|c[óo]smica|negativa|positiva|sutil|vital|divina)\b"
    r"|\benergias?\s+(?:negativas|densas|pesadas|ruins|sutis)\b"
    r"|\blimpar\s+a\s+energia\b|\btroca\s+de\s+energias\b|\bcampo\s+energ\w*"
    r"|\buniverso\s+(?:conspira|responde|providencia|manda|envia|escuta|ouve|quer|d[áa])\b"
    r"|\bpe[çc]a\s+ao\s+universo\b|\blei\s+da\s+atra[çc][ãa]o\b"
    r"|\bfor[çc]as?\s+(?:superior\w*|c[óo]smic\w*|do\s+alto)\b|\bpoderes?\s+superior\w*"
    r"|\bseres?\s+de\s+luz\b|\bmestres?\s+ascension\w*"
    # КУРС: «guia espiritual» голым ловить нельзя — m2l3.theory.pt «Um guia espiritual está
    # sentado entre duas colunas» это ОПИСАНИЕ Иерофанта, который буквально и есть духовный
    # наставник (то же самое нашёл испанский коллега на «guía espiritual»). Жаргон начинается
    # там, где проводник присваивается читателю: «seu guia espiritual», «peça ao guia».
    r"|\b(?:seu|sua|meu|minha|nosso|nossa)s?\s+guias?\s+espiritua\w*"
    r"|\bpe[çc]a\s+(?:ao|para\s+o)\s+guia\s+espiritual\b"
    r"|\bkarma\w*|\bc[áa]rmic\w*|\bk[áa]rmic\w*|\bcarma\b"
    r"|\bchakras?\b|\bchacras?\b|\baura\b|\bauras\b|\bastral\b"
    r"|\bplano\s+(?:sutil|astral)\b|\bplanos\s+sutis\b|\bcorpo\s+sutil\b"
    r"|\bmau[- ]olhado\b|\bolho\s+gordo\b|\bmedi[uú]nic\w*|\bclarivid\w*|\bterceiro\s+olho\b"
    r"|\breiki\b|\bmantras?\b|\bcristais\s+(?:de\s+cura|energ)|\bradiest\w*|\begr[ée]gora\w*"
)

# --- 3. MEDICINE --------------------------------------------------------------
#
# Медицинская рамка. Итог калибровки: 0 находок. Отброшено (замеры по 958 блокам):
#
# ⚠️ «tratar» ОТБРОШЕНО — это главная ловушка: 14 находок на \btrat\w*, ни одной
#    медицинской. В PT «tratar» = «обходиться с чем-то» («tratar as próprias forças com
#    cuidado», «jeito de tratar o próprio corpo», «trata-se de força madura»). Ловим
#    только существительное «tratamento».
# ⚠️ «exame» ОТБРОШЕНО: единственная находка — «uma atração que merece exame» = «стоит
#    рассмотреть», а не «анализы». Ловим только «exame médico / de sangue / laboratorial».
# ⚠️ «pressão» ОТБРОШЕНО: 10 находок, все — «давление» в смысле принуждения («conduza
#    pelo calor e não pela pressão», «a pressão vem de toda parte»). Ловим только
#    «pressão alta/baixa/arterial».
# ⚠️ «receita» ОТБРОШЕНО: единственная находка — «equilibrar gastos e receitas», то есть
#    ДОХОДЫ в блоке про финансы. Ловим только «receita médica».
# ⚠️ «cura/curar» ОТБРОШЕНО: 6 находок, все — душевное исцеление жанра («a carta da
#    esperança e da cura silenciosa», «o que se escolhe com sinceridade une e cura»).
#    То же решение, что в русском словаре про «исцеление».
# ⚠️ «ansiedade» и «depressão» ОТБРОШЕНЫ: 4 находки на ansiedade, все бытовые, а для
#    s09 «ansiedade» — вообще каноническое keywords.pt этой карты. Клиника начинается
#    там, где рядом диагноз или терапия, а не у самого слова.
# ⚠️ «insônia» ОТБРОШЕНО: единственная находка описывает рисунок Девятки Мечей
#    («na hora da insônia»), это симптом на картинке, а не рекомендация.
# ⚠️ «especialista» ОТБРОШЕНО: 4 находки, все про эксперта в профессии («procure um
#    especialista reconhecido», «o status de especialista»), ни одна не про врача.
# ⚠️ «clínico» (муж. род) ОТБРОШЕНО ради идиомы «olhar clínico» = «намётанный глаз»;
#    ловим только существительное «clínica».
# ⚠️ «dose» ОТБРОШЕНО заранее: «uma dose de coragem» — живая идиома, а медицинская
#    дозировка называется «dosagem».
# КУРС: check_4 гоняет медицину только по блокам health/health_reversed, которых у курса
# нет, поэтому на курсе она даёт 0. Но если кто-то решит распространить её на весь курс —
# знайте заранее: там 8 срабатываний, и все восемь законные, все в m1l4 (урок этики), где
# урок ровно этому и учит: «Diagnósticos e tratamento, com quem é da medicina», «O tarô
# pode acolher, mas não substitui médico, advogado nem psicoterapeuta». Медицинское слово
# в запрете на медицину — не дефект; расширять проверку на курс без guard'а на цитату
# и на отрицание нельзя.
MEDICINE_PT = (
    r"\bdiagn[óo]stic\w*|\bdiagnos\w*"
    r"|\btratamento\w*|\bterapi[ae]s?\b|\bterap[êe]utic\w*|\bterapeutas?\b|\bfisioterap\w*"
    r"|\bm[ée]dic[oa]s?\b|\bm[ée]dic[oa]\b|\bdoutor\w*|\benfermeir\w*"
    r"|\brem[ée]dios?\b|\bmedicamentos?\b|\bcomprimidos?\b|\bp[íi]lulas?\b|\bantibi[óo]tic\w*"
    r"|\bdosagem\b|\bposologia\b|\breceita\s+m[ée]dica\b|\bprescri[çc][ãa]o\b"
    r"|\bsintomas?\b|\bsintom[áa]tic\w*|\bdoen[çt]\w*|\benfermid\w*|\bpatologi\w*"
    r"|\bcl[íi]nicas?\b|\bhospit\w*|\bconsult[óo]rio\w*|\bfarm[áa]cia\w*|\bpronto[- ]socorro\b"
    r"|\bcirurgi\w*|\bvacina\w*|\binternad[oa]\b|\blaudo\b"
    r"|\bexames?\s+(?:m[ée]dic\w*|de\s+sangue|laboratori\w*|cl[íi]nic\w*)\b"
    r"|\bpress[ãa]o\s+(?:alta|baixa|arterial)\b|\bcolesterol\b|\bglicemia\b"
    r"|\bconsulta\s+m[ée]dica\b|\bprocure\s+um\s+m[ée]dico\b"
)

# --- 4. GENDER ----------------------------------------------------------------
#
# Род ЧИТАТЕЛЯ. В португальском он течёт не из глагола (você всегда 3 л.), а из
# СОГЛАСОВАНИЯ прилагательных и причастий, поэтому русский приём «глагол на -ла» здесь
# не работает вообще. Итог калибровки: 15 блоков с настоящими дефектами (14 из них —
# Старшие Арканы), 0 ложных срабатываний на финальной редакции.
#
# ГЛАВНЫЙ ВЫВОД КАЛИБРОВКИ: ловить надо не прилагательное, а ЯКОРЬ ПОДЛЕЖАЩЕГО.
# Голое «honest[oa]» даёт 38 находок, из которых настоящих 2 (5%): почти всегда это
# определение к существительному («uma conversa honesta», «um balanço honesto»), и род
# берётся у существительного, а не у читателя. Те же 2 находки после привязки к связке
# в инфинитиве/императиве дают 2 из 2 (100%). Такая же история со всеми остальными
# прилагательными, поэтому финитная связка («fica/está + прил.») оставлена только для
# узкого списка ЧИСТО ЧЕЛОВЕЧЕСКИХ причастий.
#
# ⚠️ Широкая ветка «связка + любое слово на -ado/-ada/-ido/-ida» ОТБРОШЕНА: 88 находок,
#    настоящих 2 (2%). Подлежащее почти всегда существительное: «Sua mente está cansada»,
#    «a corda está esticada», «a autoestima esteja amarrada», «a Imperatriz está sentada».
# ⚠️ Ветка «você … связка … прил.» с окном до 3 слов даёт 0 находок, с окном до 10 —
#    1 находку (fool.career_reversed). Вместо растягивания окна взята финитная связка с
#    человеческим списком причастий: та же одна находка и ни одного ложного.
# ⚠️ «sozinho» НЕЛЬЗЯ ловить голым: 21 находка, настоящих 4. Остальные 17 — наречие
#    «само по себе» про ПРЕДМЕТ («o que está crescendo cresce sozinho», «as circunstâncias
#    mudam sozinhas», «uma taça que transborda sozinha», «tudo se resolva sozinho») или
#    описание персонажа карты («ele está ali sozinho», «acabou sozinho» в symbolism).
#    Поэтому список глаголов перед «sozinho» узкий, и из него намеренно ИСКЛЮЧЕНЫ
#    «estar/está» и «acabou»: обе формы встречаются в корпусе только про персонажа
#    (w07.symbolism, s05.symbolism, p04.symbolism) и стоили бы 3 ложных из 7.
#    Цена решения — «você está sozinho» проверка пропустит; это осознанный размен.
# ⚠️ «um tempo sozinho» (hermit.love_reversed) НЕ ловится и не должен: там согласование
#    с «tempo», а не с читателем. Это разбиралось глазами и признано нормой.
# ⚠️ «si mesmo» голым ОТБРОШЕНО: 5 находок, 2 настоящих. Ложные — «um mundo que
#    compreende a si mesmo» (о мире), «o cuidado que devora a si mesmo» (о заботе),
#    «um fim em si mesmo» (идиома). Поэтому берём только предложные формы и отдельно
#    гасим идиому «fim em si mesmo» через lookbehind.
# ⚠️ «amigo/amigos» НЕ ловим, хотя русский словарь ловит «подруге»: в корпусе 8 находок,
#    и все — немаркированный генерик («escreva a um amigo antigo», «o encontro vem por
#    amigos»). Маркированной «amiga» в корпусе 0, то есть перекоса, который надо чинить,
#    просто нет. А вот «aja como dono» (p14.general) ловим: это роль, назначенная лично
#    читателю, прямой аналог русского «как хозяин».
# ⚠️ Форма «cansado(a)» в скобках в корпусе встречается 0 раз, ветка оставлена
#    сторожевой: это первое, что напишет переводчик, «починяя» найденный род, и
#    content-guide такую запись запрещает (ср. русское «понял(а)»).
# Полезный ориентир корпуса: канонический безродный оборот здесь — «para quem está só»
# (15+ употреблений). Все находки ниже — места, где автор из него выпал.
_PADJ_PT = (
    r"(?:cansad|exaust|esgotad|sobrecarregad|magoad|machucad|apaixonad|perdid|culpad"
    r"|orgulhos|teimos|ansios|satisfeit|grat|dispost|acostumad|preparad|frustrad"
    r"|decepcionad|isolad|paralisad|amarrad|acorrentad|aprisionad|honest|sincer"
    r"|generos|carinhos|dur|frio|calm|tranquil|realist|pr[áa]tic|objetiv|r[íi]gid"
    # КУРС: окончание ТОЛЬКО единственного числа (было «[oa]s?»). Принципиальный якорь:
    # читатель в этом продукте всегда «você», один человек, — значит множественное число
    # физически не может быть о нём. Он снял m4l7.theory.pt «duas pessoas […] acostumadas
    # a se virar sozinhas» (женский род принадлежит двум фигурам с Пятёрки Ouros) и
    # ничего не стоил на колоде: все 15 находок там в единственном числе.
    r"|atent|curios|madur|resolvid|segur|insegur|carent|sozinh)[oa]\b"
)
# Причастия, которые в этом корпусе описывают ТОЛЬКО человека, — для финитной связки.
_HUMAN_PT = (
    r"(?:paralisad|amarrad|acorrentad|aprisionad|magoad|machucad|apaixonad|exaust"
    r"|esgotad|sobrecarregad|culpad|orgulhos|teimos|acostumad|obrigad|grat|satisfeit)[oa]\b"
)
# КУРС: метаязыковая рамка «карта говорит О ТЕМЕ». В уроках карта — предмет разговора,
# и её тема называется инфинитивом: m6l2.q3.pt «as duas cartas falam de ficar sozinho».
# Это НАЗВАНИЕ состояния, а не состояние читателя. В колоде такой рамки нет ни разу
# (там говорят читателю, а не о карте), поэтому lookbehind'ы ничего не стоят на картах.
_META = (r"(?<!falam de )(?<!fala de )(?<!falam sobre )(?<!fala sobre )(?<!trata de )"
         r"(?<!tratam de )(?<!tratam sobre )(?<![ée] sobre )(?<!significa )(?<!chamamos de )")
# КУРС: якорь «текст обращается к читателю» — либо явное «você», либо императив вежливой
# формы. Нужен там, где местоимение «si/consigo» само по себе рода не выдаёт: см. разбор
# ветки 5 ниже.
_READER_PT = (r"(?:\bvoc[êe]\b|\b(?:diga|fale|pergunte|pergunte-se|confira|olhe|pense"
              r"|reconhe[çc]a|permita-se|permita|repare|note|escreva|fa[çc]a|seja|fique"
              r"|conte|cuide|lembre|escute|observe|anote|tente|experimente|convida)\b)")
GENDER_PT = [
    # 1. Связка в инфинитиве: подлежащее подразумевается — это читатель.
    #    «Ser honesto consigo», «o risco é acabar amarrado», «medo de ficar sozinho»,
    #    «para parecer bem resolvido».
    _META +
    r"\b(?:ficar|estar|acabar|continuar|virar|sentir-se|se sentir|ver-se|se ver|ser|parecer"
    r"|permanecer|andar)\s+(?:\w+\s+){0,1}" + _PADJ_PT,
    # 2. Императив, обращённый к читателю: «Seja honesto sobre qual sentimento…».
    #    «esteja» из списка убрано намеренно: в корпусе 15 употреблений, из них
    #    «a autoestima esteja amarrada» — про самооценку, а не про читателя.
    r"\b(?:seja|fique|sinta-se|mantenha-se|continue|torne-se|permita-se ser)\s+"
    r"(?:mais\s+|bem\s+|muito\s+)?" + _PADJ_PT,
    # 3. Финитная связка + чисто человеческое причастие: «ou fica paralisado antes do
    #    primeiro passo».
    #    КУРС: теперь обязателен явный «você» слева в ТОМ ЖЕ предложении (окно 60 знаков).
    #    Финитная связка сама по себе о подлежащем ничего не говорит, а в португальском
    #    подлежащее чаще всего существительное: на курсе это стоило ложного
    #    m4l6.theory.pt «uma mulher está amarrada e vendada» — описание Восьмёрки Мечей.
    #    На колоде якорь бесплатен: единственная настоящая находка ветки
    #    («ou você entra em algo novo […], ou fica paralisado») содержит «você» в 33 знаках.
    r"\bvoc[êe]\b[^.!?…]{0,60}?"
    r"\b(?:fica|ficou|est[áa]|acaba|continua|anda|vira|virou|permanece|segue)\s+"
    r"(?:\w+\s+){0,1}" + _HUMAN_PT,
    # 4. sozinho/sozinha о читателе — только после «человеческих» глаголов (см. разбор выше).
    #    КУРС: добавлен запрет на местоименную форму «se + инфинитив + sozinho».
    #    Это не косметика, а грамматика: «se resolver sozinho» / «se virar sozinhas» — это
    #    «само собой», подлежащее там ПРЕДМЕТ (m6l3.q5_opt3_wrong.pt «tudo vai se resolver
    #    sozinho»), а непереходная неместоименная форма («agir/pensar/ficar sozinho») —
    #    про человека. Все четыре находки колоды неместоименные, якорь их не трогает.
    _META + r"(?<!\bse\s)"
    r"\b(?:ficar|fica|ficando|ficaria|se sentir|se sente|sentir-se|agir|pensar|decidir"
    r"|resolver|resolve|viver|morar|acabar|acaba|carregar)\s+(?:\w+\s+){0,2}sozinh[oa]\b",
    # 5. Род читателя в местоимении. Ветка разделена на три после курса.
    #    5a. «você mesmo/mesma» — 2-е лицо названо прямо, двусмысленности нет.
    #        Множественное «vocês mesmos» убрано (см. якорь единственного числа выше).
    r"\bvoc[êe]\s+mesm[oa]\b",
    #    5b. «em si mesmo» — именная конструкция «a confiança em si mesmo» (star.reversed).
    #        Идиома «um fim em si mesmo» гасится lookbehind'ом (p14.reversed).
    #        На курсе таких 0.
    r"(?<!\bfim )\bem\s+si\s+mesm[oa]\b",
    #    5c. «para/com/por/a si mesmo» и «consigo mesmo» — ТОЛЬКО когда текст обращён к
    #        читателю (есть «você» или императив в том же предложении).
    #        КУРС: это самая шумная ветка первой редакции — 6 ложных из 6 голых находок.
    #        Все они безличные, и подлежащее там не читатель, а инфинитив-умение:
    #        m6l3.theory.pt ×2 и m6l3.q4/q4_opt3.pt «ler para si mesmo» (противопоставлено
    #        «ler para uma pessoa de fora» — это «читать СЕБЕ» как жанр расклада),
    #        m4l7.q4_opt1_wrong.pt «só dá para contar consigo mesmo» (безличное «dá para»).
    #        Испанский коллега тем же классом выбросил «uno mismo» целиком; здесь целиком
    #        выбрасывать нельзя — на колоде эта форма даёт настоящую находку
    #        p12.health_reversed «o ritmo que VOCÊ começou foi abandonado […] nem para si
    #        mesmo», и правка колоды («nem para você») подтвердила, что это был дефект.
    #        Поэтому не выброс, а якорь адресации.
    _READER_PT + r"[^.!?…]{0,110}?\b(?:para|com|por|a|de)\s+si\s+mesm[oa]\b",
    _READER_PT + r"[^.!?…]{0,110}?\bconsigo\s+mesm[oa]\b",
    # 6. Скобочная форма «cansado(a)» — запрещена стилем (сторожевая ветка, 0 находок
    #    и на колоде, и на курсе).
    r"\b\w+[oa]\(a\)|\b\w+\([oa]s?\)|\b\w+[oa]/a\b",
    # 7. Гендерная РОЛЬ, назначенная читателю: «aja como dono».
    r"\b(?:aja|seja|sinta-se|comporte-se|vista-se|pense)\s+como\s+(?:um\s+|uma\s+|o\s+|a\s+)?"
    r"(?:dono|dona|homem|mulher|pai|m[ãa]e|filho|filha|chefe|patr[ãa]o|rei|rainha|guerreir[oa])\b",
]

# --- 5. GLOSSARY --------------------------------------------------------------
#
# Канон из cards.json (name.pt): масти — Paus, Copas, Espadas, Ouros; двор — Valete,
# Cavaleiro, Rainha, Rei; Старшие — O Louco, A Sacerdotisa, O Hierofante, Os Enamorados,
# O Eremita, O Enforcado, O Julgamento и т. д. Перевёрнутое положение по всему корпусу
# называется «invertido/invertida» (77 из 78 блоков reversed).
#
# Итог калибровки: 1 находка (fool.reversed).
#
# ⚠️ ГЛАВНАЯ ЛОВУШКА, ровно как в русском словаре с «чашей» и «посохом»: предметы на
#    картинке называть можно, МАСТЬ — нельзя. «bastão/bastões» 22 раза, «taça/taças» 29,
#    «moeda(s)» 7, «pentáculo(s)» 5, «varas» 1, «cálice» 1 — и ВСЕ они в symbolism, про
#    нарисованные жезлы, чаши и монеты («as sete moedas entre as folhas», «o pentáculo
#    dourado representa a matéria»). Ни одного «Ás de Pentáculos» или «naipe de Bastões»
#    в корпусе нет. Поэтому ловим только термин В ПОЗИЦИИ МАСТИ: после ранга/фигуры
#    («Dois de Cálices»), после «naipe de», либо в паре «carta de Pentáculos».
# ⚠️ «Waite» голым ловить нельзя: 7 законных ссылок на автора («nas palavras de Waite»).
#    Ветка «Rider-Waite» перенесена из английского словаря как сторожевая, 0 находок.
# ⚠️ «ao contrário» НЕ синоним «invertida»: 5 находок, все — дискурсивное «наоборот»
#    («ou, ao contrário, o otimismo corre à frente dos números»). Ловим только связку
#    с запятой «de cabeça para baixo,» в позиции обстоятельства положения — она в корпусе
#    ровно одна (fool.reversed) и действительно ломает канон; при этом законные
#    «pende de cabeça para baixo numa árvore» и «virar de cabeça para baixo a imagem»
#    у Повешенного (2 находки) под неё не попадают, потому что там нет запятой.
GLOSSARY_PT = (
    r"\b(?:[ÁA]s|Dois|Tr[êe]s|Quatro|Cinco|Seis|Sete|Oito|Nove|Dez|Valete|Cavaleiro|Rainha|Rei)"
    r"\s+de\s+(?:Bast[õo]es|Varas|Cetros|C[áa]lices|Ta[çc]as|Pent[áa]culos|Moedas|Discos|Den[áa]rios)\b"
    r"|\bnaipes?\s+(?:de\s+|dos\s+|das\s+)?"
    r"(?:bast[õo]es|varas|cetros|c[áa]lices|ta[çc]as|pent[áa]culos|moedas|discos|den[áa]rios)\b"
    r"|\bcartas?\s+de\s+(?:bast[õo]es|c[áa]lices|pent[áa]culos|moedas|discos)\b"
    r"|\b(?:Pajem|Sota|Princesa|Pr[íi]ncipe|Escudeiro|Cavalo)\s+de\s+(?:Paus|Copas|Espadas|Ouros)\b"
    r"|\bOs\s+Amantes\b|\bO\s+Bobo\b|\bA\s+Papisa\b|\bO\s+Papa\b|\bO\s+Ermit[ãa]o\b"
    r"|\bO\s+Ju[íi]zo\b|\bO\s+Pendurado\b|\bA\s+Roda\s+do\s+Destino\b|\bO\s+Mata\b"
    # КУРС: якорь «запятая» оказался слишком слабым — m3l3.q3_explain.pt «De cabeça para
    # baixo, você enxerga o que não dá para ver na correria» это БУКВАЛЬНЫЙ Повешенный
    # (он и правда висит вниз головой), и запятая там законная. Ловушку я описал ещё в
    # первой волне, но якорь её не отработал. Теперь требуем то, что и составляет дефект:
    # оборот стоит ВМЕСТО «invertido» ПЕРЕД ИМЕНЕМ КАРТЫ («De cabeça para baixo, o Louco
    # alerta…»). Регистр в якорь не заложен намеренно: check_canon зовёт регулярку с
    # re.IGNORECASE, и класс [A-Z] там не сработал бы.
    r"|\bde\s+cabe[çc]a\s+para\s+baixo\s*,\s*(?:[oa]s?\s+)?"
    r"(?:carta|[ÁA]s|Dois|Tr[êe]s|Quatro|Cinco|Seis|Sete|Oito|Nove|Dez|Valete|Cavaleiro"
    r"|Rainha|Rei|Louco|Mago|Sacerdotisa|Imperatriz|Imperador|Hierofante|Enamorados|Carro"
    r"|For[çc]a|Eremita|Roda|Justi[çc]a|Enforcado|Morte|Temperan[çc]a|Diabo|Torre|Estrela"
    r"|Lua|Sol|Julgamento|Mundo)\b"
    r"|\bde\s+ponta[- ]?cabe[çc]a\b|\bcartas?\s+revers\w*|\bposi[çc][ãa]o\s+contr[áa]ria\b"
    r"|\bRider[- ]Waite\b"
)

# --- что реально нашлось в корпусах после калибровки --------------------------
# Ключ — "<card_id>.<block>" для колоды и "<lesson_id>.<block>" для курса
# (m3l4.theory, m4l6.q2_explain), как их адресует check_canon.
FINDINGS = {
    # Колода: ноль (86 находок широкого будущего и 12 «promete» разобраны в комментарии).
    # Курс: ноль после guard'а на кавычки. Оба снятых были называнием запрещённой
    # формулировки, а не её употреблением:
    #   m3l2.theory.pt   «“o destino decide tudo” não é a conclusão desta carta, e sim a
    #                     armadilha dela» — урок Колеса разбирает пассивность как ловушку;
    #   m6l4.q5_explain.pt «A opção “com certeza a seu favor” é justamente a armadilha da
    #                     previsão que o curso pediu para evitar» — цитата варианта ответа.
    # Ещё 4 срабатывания живут в неверных вариантах викторины (m6l1.q5_opt1_wrong,
    # m6l3.q5_opt3_wrong, m6l4.q3_opt2_wrong, m6l4.q5_opt3_wrong) — их снимает штатный
    # _without_distractors, и это ровно та рамка, которую урок учит распознавать.
    "prediction": [],
    # Колода: ноль. Курс: ноль. Снято одно ложное — m2l3.theory.pt «Um guia espiritual
    # está sentado entre duas colunas»: это описание Иерофанта. Ещё одно («forças
    # superiores») живёт в дистракторе m1l1.q1_opt1_wrong и снимается штатно.
    "jargon": [],
    # Колода: ноль. Курс: проверка туда не доходит (только health-блоки), см. примечание
    # к MEDICINE_PT про 8 законных срабатываний в уроке этики m1l4.
    "medicine": [],
    # Колода: ноль — все 16 мест первой волны исправлены (список ниже, FIXED_IN_CARDS).
    # Курс: 3 после калибровки, 12 ложных снято. Эти три я считаю НАСТОЯЩИМИ, и вот
    # почему: в каждом из них текст обращается к читателю, а согласуемое слово стоит в
    # мужском роде. Это ровно те конструкции, которые в колоде были признаны дефектом и
    # переписаны («Confira os detalhes você mesmo» → «por conta própria», «nem para si
    # mesmo» → «nem para você»). Правка тут такая же дешёвая.
    "gender": [
        ("m3l4.theory",
         "Só no momento em que a mão já estiver indo, diga para si mesmo: «isto é uma "
         "corrente» — императив обращён к читателю, «mesmo» согласуется с ним"),
        ("m4l6.q2_explain",
         "ela convida você a conferir se a cautela não virou um esconde-esconde consigo "
         "mesmo — «você» названо прямо, «mesmo» о нём же"),
        ("m6l1.theory",
         "Já quando você mesmo estende as cartas, elas caem como caem — та же форма, что "
         "четырежды исправлена в колоде"),
    ],
    # Колода: ноль (fool.reversed исправлен на «O Louco invertido»). Курс: ноль после
    # привязки к имени карты; снято ложное m3l3.q3_explain.pt «De cabeça para baixo, você
    # enxerga o que não dá para ver na correria» — буквальный Повешенный, а не название
    # перевёрнутого положения.
    "glossary": [],
}

# История первой волны: что было найдено в колоде и уже исправлено редакцией.
# Держим списком, а не в FINDINGS, чтобы регрессию было по чему гонять: предыдущая
# версия карт лежит в /mnt/user-data/uploads/my-projects/arcanum/content/cards.json,
# и на ней эти 15 родовых + 1 глоссарийная находка обязаны ловиться после любой правки
# словаря (devil.finances в том файле уже переписан частично, поэтому 15, а не 16).
FIXED_IN_CARDS = {
    "gender": [
        ("fool.career_reversed", "ou fica paralisado → ficou «fica sem ação»"),
        ("high-priestess.finances_reversed", "Confira os detalhes você mesmo → por conta própria"),
        ("emperor.finances_reversed", "os limites que você mesmo colocou → que você colocou para si"),
        ("lovers.general", "Ser honesto consigo → A sinceridade consigo"),
        ("lovers.finances_reversed", "Antes de agir sozinho → antes de agir cada um por si"),
        ("strength.finances_reversed", "Seja honesto sobre → Reconheça com honestidade"),
        ("hermit.general", "ouvir você mesmo → ouvir a própria voz"),
        ("hermit.career_reversed", "resolve tudo sozinho → resolve tudo por conta própria"),
        ("hermit.finances_reversed", "pensar sozinho → pensar sem consultar ninguém"),
        ("justice.finances_reversed", "Confira os extratos você mesmo → pessoalmente"),
        ("star.reversed", "a confiança em si mesmo → a confiança em si"),
        ("devil.finances", "o risco é acabar amarrado → o risco é virar refém das dívidas"),
        ("devil.love_reversed", "medo de ficar sozinho → medo da solidão"),
        ("c10.finances_reversed", "parecer bem resolvido → dar a impressão de vida resolvida"),
        ("p12.health_reversed", "nem para si mesmo → nem para você"),
        ("p14.general", "aja como dono → trate tudo como se fosse seu"),
    ],
    "glossary": [
        ("fool.reversed", "De cabeça para baixo, o Louco → O Louco invertido"),
    ],
}
