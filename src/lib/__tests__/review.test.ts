import type { CourseModule } from '../content';
import { cards } from '../content';
import type { LessonProgressMap } from '../courseProgress';
import { inLang, LANGS, presentLang, type Localized } from '../lang';
import {
  applyGrade,
  applyReview,
  buildSession,
  deckOrder,
  doneToday,
  maskCardName,
  mergeReviewDay,
  NAME_MASK,
  NEW_PER_DAY,
  nextSessionSize,
  PROMPT_MAX,
  PROMPT_MIN,
  promptSentence,
  reviewCardState,
  REVIEW_DAY_DEFAULT,
  reviewSummary,
  SESSION_MAX,
  sessionStats,
  type ReviewDay,
  type ReviewLogEntry,
  type ReviewSummary,
  type SessionItem,
  type SrsMap,
} from '../review';
import type { SrsState } from '../srs';
import { XP_REVIEW } from '../xp';

const T = '2026-08-19';
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};
// карта с состоянием, due задан
const st = (due: string, extra: Partial<SrsState> = {}): SrsState => ({ reps: 1, intervalDays: 1, ease: 2.5, due, ...extra });
// колода из n карт c1..cn
const deck = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);
// srs, где карты c1..ck просрочены на k, k−1, … дней (c1 самая старая)
const overdue = (k: number): SrsMap =>
  Object.fromEntries(Array.from({ length: k }, (_, i) => [`c${i + 1}`, st(`2026-08-${String(19 - (k - i)).padStart(2, '0')}`)]));

// фабрика модулей — как в courseProgress.test.ts
const fx = (id: string, lessons: number, cardsPerLesson = 0): CourseModule => ({
  id,
  free: true,
  title: { ru: id, en: id },
  lessons: Array.from({ length: lessons }, (_, i) => ({
    id: `${id}${i + 1}`,
    title: { ru: `${id}${i + 1}`, en: `${id}${i + 1}` },
    cards: Array.from({ length: cardsPerLesson }, (_, c) => `${id}${i + 1}-card-${c}`),
  })),
});
const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

describe('deckOrder — колода = карты пройденных уроков в порядке курса', () => {
  it('пустой прогресс → пустая колода; порядок — по урокам, повтор карты не дублируется', () => {
    const mods = [fx('a', 2, 2), fx('b', 1, 2)];
    expect(deckOrder(mods, {})).toEqual([]);
    expect(deckOrder(mods, done('a2', 'a1'))).toEqual(['a1-card-0', 'a1-card-1', 'a2-card-0', 'a2-card-1']);
    // урок-повторение перечисляет карту заново — в колоде она один раз
    const withRepeat: CourseModule[] = [{ ...mods[0], lessons: [...mods[0].lessons, { id: 'a3', title: { ru: 'a3', en: 'a3' }, cards: ['a1-card-0'] }] }];
    expect(deckOrder(withRepeat, done('a1', 'a3'))).toEqual(['a1-card-0', 'a1-card-1']);
  });
});

describe('reviewSummary — сводка для карточки курса и DEV-диалога', () => {
  it('пустая колода — нули', () => {
    expect(reviewSummary([], {}, T, REVIEW_DAY_DEFAULT)).toEqual({ deckSize: 0, due: 0, newAvailable: 0, dueTomorrow: 0 });
  });
  it('due считает просроченные и сегодняшние, dueTomorrow — до завтра включительно, новые — без состояния', () => {
    const srs: SrsMap = { c1: st('2026-08-18'), c2: st(T), c3: st('2026-08-20'), c4: st('2026-08-21') };
    const s = reviewSummary(deck(6), srs, T, REVIEW_DAY_DEFAULT);
    expect(s).toEqual({ deckSize: 6, due: 2, newAvailable: 2, dueTomorrow: 3 });
    // состояние «всё повторено»: просроченных нет — dueTomorrow = ровно завтра
    expect(reviewSummary(['c3', 'c4'], srs, T, REVIEW_DAY_DEFAULT)).toMatchObject({ due: 0, dueTomorrow: 1 });
  });
  it('newAvailable режется дневным лимитом: сегодняшний счётчик учитывается, вчерашний — нет', () => {
    const today: ReviewDay = { date: T, newCount: 8, doneCount: 0 };
    const yesterday: ReviewDay = { date: '2026-08-18', newCount: 8, doneCount: 0 };
    expect(reviewSummary(deck(20), {}, T, today).newAvailable).toBe(NEW_PER_DAY - 8);
    expect(reviewSummary(deck(20), {}, T, yesterday).newAvailable).toBe(NEW_PER_DAY);
    expect(reviewSummary(deck(20), {}, T, { date: T, newCount: NEW_PER_DAY, doneCount: 0 }).newAvailable).toBe(0);
  });
  it('состояние карты, выпавшей из колоды (сброс курса), не считается', () => {
    expect(reviewSummary(['c1'], { c1: st(T), zzz: st(T) }, T, REVIEW_DAY_DEFAULT).due).toBe(1);
  });
});

describe('buildSession — порция ≤ SESSION_MAX', () => {
  it('12 просроченных → 10 самых старых, все повторяемые (isNew false)', () => {
    const s = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(1));
    expect(s).toHaveLength(SESSION_MAX);
    const ids = s.map((i) => i.cardId).sort();
    expect(ids).toEqual(deck(10).sort()); // c11, c12 (самые свежие) не вошли
    expect(s.every((i) => !i.isNew)).toBe(true);
  });
  it('3 просроченных + 20 новых → 3 + 7 новых; новые — первые по порядку колоды и всегда toMeaning', () => {
    const s = buildSession(deck(23), overdue(3), T, REVIEW_DAY_DEFAULT, lcg(2));
    expect(s).toHaveLength(10);
    const fresh = s.filter((i) => i.isNew);
    expect(fresh).toHaveLength(7);
    expect(fresh.map((i) => i.cardId).sort()).toEqual(['c10', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9']);
    expect(fresh.every((i) => i.direction === 'toMeaning')).toBe(true);
  });
  it('лимит новых в день: newCount = 8 → в сессии не больше 2 новых; = 10 → новых нет', () => {
    expect(buildSession(deck(20), {}, T, { date: T, newCount: 8, doneCount: 0 }, lcg(3))).toHaveLength(2);
    expect(buildSession(deck(20), {}, T, { date: T, newCount: NEW_PER_DAY, doneCount: 0 }, lcg(3))).toEqual([]);
  });
  it('сидированный rng — детерминированный порядок и направления; повторяемым выпадают оба направления', () => {
    const a = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(5));
    const b = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(5));
    expect(a).toEqual(b);
    const dirs = new Set(a.map((i) => i.direction));
    expect(dirs.has('toMeaning') && dirs.has('toCard')).toBe(true);
  });
  it('пустая колода → пустая сессия', () => {
    expect(buildSession([], {}, T, REVIEW_DAY_DEFAULT, lcg(1))).toEqual([]);
  });
});

describe('applyGrade — очередь сессии', () => {
  const q: SessionItem[] = [
    { cardId: 'a', direction: 'toMeaning', isNew: true },
    { cardId: 'b', direction: 'toCard', isNew: false },
  ];
  it('«не помню» возвращает карту в хвост, passed false', () => {
    expect(applyGrade(q, 0)).toEqual({ queue: [q[1], q[0]], passed: false });
  });
  it('оценка ≥1 снимает карту, passed true', () => {
    expect(applyGrade(q, 1)).toEqual({ queue: [q[1]], passed: true });
    expect(applyGrade(q, 2)).toEqual({ queue: [q[1]], passed: true });
  });
  it('пустая очередь — пустая очередь', () => {
    expect(applyGrade([], 2)).toEqual({ queue: [], passed: false });
  });
});

describe('applyReview — единственная запись в srs/reviewDay/XP (стор только применяет)', () => {
  it('новая карта, «помню»: состояние появилось, newCount +1 с сегодняшней датой, +XP_REVIEW', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'c1', 2, T);
    expect(r.srs.c1).toMatchObject({ reps: 1, due: '2026-08-20' });
    expect(r.day).toEqual({ date: T, newCount: 1, doneCount: 1 });
    expect(r.gained).toBe(XP_REVIEW);
  });
  it('вчерашний счётчик новых сбрасывается, сегодняшний — растёт', () => {
    expect(applyReview({}, { date: '2026-08-18', newCount: 7, doneCount: 4 }, 'c1', 2, T).day).toEqual({ date: T, newCount: 1, doneCount: 1 });
    expect(applyReview({}, { date: T, newCount: 7, doneCount: 4 }, 'c1', 2, T).day).toEqual({ date: T, newCount: 8, doneCount: 5 });
  });
  it('повторяемая карта счётчик новых не трогает', () => {
    // date уже сегодняшняя, поэтому «day как есть» здесь неотличимо от пересчёта newCount —
    // но doneCount меняется (карта покинула очередь), так что сравнивать нужно по значению,
    // не по ссылке (раньше `.toBe(day)` проверял, что prev !== undefined вернул тот же объект —
    // теперь nextDay строится заново всегда, и это верное поведение, а не дефект)
    const day: ReviewDay = { date: T, newCount: 3, doneCount: 0 };
    expect(applyReview({ c1: st(T) }, day, 'c1', 2, T).day).toEqual({ date: T, newCount: 3, doneCount: 1 });
  });
  it('XP: «не помню» — 0; провал и затем «помню» — +1; повторный «помню» карты, уже ушедшей на завтра, — 0', () => {
    const r0 = applyReview({ c1: st(T) }, REVIEW_DAY_DEFAULT, 'c1', 0, T);
    expect(r0.gained).toBe(0);
    const r1 = applyReview(r0.srs, r0.day, 'c1', 2, T);
    expect(r1.gained).toBe(XP_REVIEW);
    const r2 = applyReview(r1.srs, r1.day, 'c1', 2, T);
    expect(r2.gained).toBe(0);
    expect(r2.srs.c1.reps).toBe(2); // состояние всё равно обновилось — только XP не даётся
  });
  it('вход не мутируется', () => {
    const srs: SrsMap = { c1: st(T) };
    const day = { ...REVIEW_DAY_DEFAULT };
    applyReview(srs, day, 'c1', 3, T);
    expect(srs.c1.reps).toBe(1);
    expect(day).toEqual(REVIEW_DAY_DEFAULT);
  });
});

describe('sessionStats и инвариант «xp экрана = xp стора»', () => {
  it('лог «0, 2» одной карты: cards 1, firstTry 0, xp 1; две карты с первого раза — firstTry 2', () => {
    expect(sessionStats([{ cardId: 'a', grade: 0 }, { cardId: 'a', grade: 2 }])).toEqual({ cards: 1, firstTry: 0, xp: XP_REVIEW });
    expect(sessionStats([{ cardId: 'a', grade: 3 }, { cardId: 'b', grade: 2 }])).toEqual({ cards: 2, firstTry: 2, xp: 2 * XP_REVIEW });
    expect(sessionStats([])).toEqual({ cards: 0, firstTry: 0, xp: 0 });
  });
  it('симуляция сессии: сумма gained по applyReview равна sessionStats(log).xp', () => {
    let srs: SrsMap = overdue(4); // c1..c4 просрочены
    let day: ReviewDay = REVIEW_DAY_DEFAULT;
    let queue = buildSession(deck(6), srs, T, day, lcg(9)); // 4 просроченных + 2 новых
    expect(queue).toHaveLength(6);
    // сценарий: первые две карты «не помню», потом всё «помню»
    const script = [0, 0, 2, 2, 2, 2, 2, 2];
    const log: ReviewLogEntry[] = [];
    let gainedTotal = 0;
    for (const g of script as (0 | 2)[]) {
      const head = queue[0];
      const r = applyReview(srs, day, head.cardId, g, T);
      srs = r.srs; day = r.day; gainedTotal += r.gained;
      log.push({ cardId: head.cardId, grade: g });
      queue = applyGrade(queue, g).queue;
    }
    expect(queue).toEqual([]);
    const stats = sessionStats(log);
    expect(stats).toEqual({ cards: 6, firstTry: 4, xp: 6 * XP_REVIEW });
    expect(gainedTotal).toBe(stats.xp);
    // после сессии повторять нечего, новых сегодня введено 2
    expect(reviewSummary(deck(6), srs, T, day)).toMatchObject({ due: 0, newAvailable: 0 });
    expect(day).toEqual({ date: T, newCount: 2, doneCount: 6 });
  });
});

describe('promptSentence — первое предложение general для оборота/подсказки', () => {
  it('обычный текст — до первой точки', () => {
    expect(promptSentence('Дурак — карта начала пути. Дальше идёт второе предложение.')).toBe('Дурак — карта начала пути.');
  });
  it('короткое первое предложение (< PROMPT_MIN) — берём до второго', () => {
    expect(promptSentence('Дурак. Карта начала пути и доверия миру.')).toBe('Дурак. Карта начала пути и доверия миру.');
  });
  it('«…», «!» и «?» — тоже концы предложений; точка внутри слова — нет', () => {
    expect(promptSentence('Всё только начинается… Дальше текст.')).toBe('Всё только начинается…');
    expect(promptSentence('Что ждёт впереди на этом пути? Неизвестно.')).toBe('Что ждёт впереди на этом пути?');
    expect(promptSentence('Версия 1.5 карты меняет всё. Ещё.')).toBe('Версия 1.5 карты меняет всё.');
  });
  it('текст без знака конца — целиком; пустой — пустая строка; длинное режется до PROMPT_MAX с «…»', () => {
    expect(promptSentence('без точки в конце')).toBe('без точки в конце');
    expect(promptSentence('   ')).toBe('');
    const long = 'а'.repeat(200) + '. Второе.';
    const out = promptSentence(long);
    expect(out.length).toBe(PROMPT_MAX);
    expect(out.endsWith('…')).toBe(true);
  });
  // Обходит ВСЕ LANGS по той же причине, что и контракт маски ниже: подсказка тренажёра
  // строится из general на языке ПОКАЗАННОГО текста, и волна переводов 28 приносит новые
  // тексты в этот же путь. До приёмки L-1 здесь стояли литералы ['ru', 'en'] — соседний
  // контракт в этом же файле уже был расширен на LANGS, а этот остался, то есть испанский
  // general существовал бы и не проверялся ничем. У языка без перевода inLang честно падает
  // на английский, и проверка повторяет английский — это не притворство: ровно такую строку
  // и покажет экран.
  it.each(LANGS)(
    'контракт по корпусу %s: первое предложение general в коридоре и является началом текста',
    (lang) => {
      for (const c of cards) {
        const text = inLang(c.content.general, lang);
        const p = promptSentence(text);
        expect(`${c.id}: длина ${p.length >= PROMPT_MIN}`).toBe(`${c.id}: длина true`);
        // строгая проверка: результат обязан быть НАЧАЛОМ текста без изменений. Обрезка
        // добавляет «…», которого в исходном тексте на этом месте нет, — падает и на ней
        expect(`${c.id}: начало ${text.trim().startsWith(p)}`).toBe(`${c.id}: начало true`);
      }
    },
  );
});

describe('maskCardName — имя карты в подсказке toCard заменяется на «···»', () => {
  it('ru: имя в начале предложения; регистр не важен', () => {
    expect(maskCardName('Дурак — карта начала пути.', 'Дурак')).toBe(`${NAME_MASK} — карта начала пути.`);
    expect(maskCardName('ДУРАК — карта.', 'Дурак')).toBe(`${NAME_MASK} — карта.`);
  });
  it('en: артикль The уходит вместе с именем; имя без артикля в name тоже маскируется', () => {
    expect(maskCardName('The Fool is the card of beginnings.', 'The Fool')).toBe(`${NAME_MASK} is the card of beginnings.`);
    expect(maskCardName('The Ace of Wands is the spark.', 'Ace of Wands')).toBe(`${NAME_MASK} is the spark.`);
    // «Wheel Of Fortune» в name против «Wheel of Fortune» в тексте — регистр
    expect(maskCardName('The Wheel of Fortune is the card of the turning point.', 'Wheel Of Fortune')).toBe(`${NAME_MASK} is the card of the turning point.`);
  });
  it('маскируются ВСЕ вхождения, но только целым словом: «примирения» не режется, «literal death» — да', () => {
    expect(maskCardName('Мир — карта примирения с собой и мир вокруг.', 'Мир')).toBe(
      `${NAME_MASK} — карта примирения с собой и ${NAME_MASK} вокруг.`,
    );
    // реальный случай корпуса: у Смерти слово стоит в первом предложении дважды
    expect(maskCardName('Death is the card of endings — and it is almost never about literal death.', 'Death')).toBe(
      `${NAME_MASK} is the card of endings — and it is almost never about literal ${NAME_MASK}.`,
    );
  });
  it('имени в тексте нет — текст как есть', () => {
    expect(maskCardName('Карта начала пути.', 'Дурак')).toBe('Карта начала пути.');
  });

  // Нашла волна L-2: в романских языках предлог сливается с артиклем в одно слово
  // (pt «em» + «o» → «no», es «de» + «el» → «del»), поэтому имя из name («O Três de Paus»)
  // в тексте выглядит как «No Três de Paus» — поиск полного имени его не находил, и рубашка
  // тренажёра печатала ответ. Контракт по корпусу поймал это на w03.pt.
  it('pt: предлог, слитый с артиклем, не прячет имя от маски', () => {
    expect(maskCardName('No Três de Paus, seus barcos já estão navegando.', 'O Três de Paus')).toBe(
      `No ${NAME_MASK}, seus barcos já estão navegando.`,
    );
  });

  it('es: слитная форма del/al тоже не прячет имя', () => {
    expect(maskCardName('El mensaje del Tres de Bastos es claro.', 'El Tres de Bastos')).toBe(
      `El mensaje del ${NAME_MASK} es claro.`,
    );
  });

  it('снятие артикля не ломает имя, которое само начинается с похожих букв', () => {
    // «Os» в «Os Enamorados» — артикль, а «Ases» начинается с тех же букв и артиклем не является
    expect(maskCardName('Dois Ases lado a lado.', 'Ases')).toBe(`Dois ${NAME_MASK} lado a lado.`);
  });

  // контракт по корпусу: ни одна подсказка toCard не содержит имени своей карты — ни на одном языке
  // приложения. Это и есть дефект, найденный при дорисовке макета; тест обязан быть красным без
  // maskCardName. Обходит ВСЕ LANGS, не только ['ru', 'en'] — иначе задача 28 (переводы ES/PT)
  // добавила бы язык, который этот контракт не увидит В ПРИНЦИПЕ. Имя берётся так же, как на
  // экране (app/review.tsx) — на языке ПОКАЗАННОГО текста (presentLang), а не lang напрямую: у es/pt
  // сегодня нет своего general (корпус ещё не переведён), presentLang честно падает на тот же 'en',
  // что и сам текст, — то есть для непереведённых языков тест проверяет РОВНО ТО, что покажет экран
  // прямо сейчас (комбинацию en/en), а не притворяется, что проверил испанский или пропускает его
  // молча.
  it.each(LANGS)('корпус %s: promptSentence(general) после маски не содержит имени карты', (lang) => {
    const leaks = cards
      .map((c) => {
        const textLang = presentLang(c.content.general, lang);
        const name = inLang(c.name, textLang);
        const hint = maskCardName(promptSentence(inLang(c.content.general, lang)), name);
        const bare = name.replace(/^the\s+/i, '');
        return new RegExp(bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(hint) ? `${c.id}: ${hint}` : null;
      })
      .filter(Boolean);
    expect(leaks).toEqual([]);
  });

  // синтетика: воспроизводит ровно тот сценарий, который сегодняшний корпус показать не может
  // (name.es есть, general.es нет — 28а разводит их разными единицами перевода). Проверяет тот же
  // алгоритм, что app/review.tsx использует для маски (textLang = presentLang(general, lang), имя —
  // inLang(name, textLang)), и одновременно фиксирует, что НАИВНЫЙ выбор (имя языка интерфейса без
  // presentLang — состояние ДО фикса Important 1) на этом же входе действительно течёт. Это и есть
  // «эксперимент со сломанным кодом» из отчёта: временная замена textLang на голый lang красит
  // именно этот тест (см. final-fix-report.md)
  it('расхождение языков name/general (будущий сценарий задачи 28): маска берёт язык показанного текста, а не интерфейса', () => {
    const name: Localized<string> = { ru: 'Дурак', en: 'The Fool', es: 'El Loco' };
    const general: Localized<string> = {
      ru: 'Дурак — карта начала пути.',
      en: 'The Fool is the card of beginnings.',
      // es намеренно нет: presentLang(general, 'es') падает на 'en'
    };

    const textLang = presentLang(general, 'es');
    const correctHint = maskCardName(promptSentence(inLang(general, 'es')), inLang(name, textLang));
    expect(correctHint).not.toMatch(/fool/i);
    expect(correctHint).toContain(NAME_MASK);

    // наивный выбор — имя языка интерфейса напрямую, без presentLang: «El Loco» не встречается
    // в английском предложении, маска молчит, и подсказка отдаёт готовый ответ
    const naiveName = inLang(name, 'es');
    const naiveHint = maskCardName(promptSentence(inLang(general, 'es')), naiveName);
    expect(naiveHint).toMatch(/fool/i);
  });

  it('«the» внутри соседнего слова не съедает настоящее вхождение имени', () => {
    expect(maskCardName('soothe Empress vibes are strong.', 'Empress')).toBe(`soothe ${NAME_MASK} vibes are strong.`);
    expect(maskCardName('Let it bathe Empress light over you.', 'Empress')).toBe(`Let it bathe ${NAME_MASK} light over you.`);
    // артикль перед именем по-прежнему уходит вместе с ним
    expect(maskCardName('Read the Empress as a season.', 'Empress')).toBe(`Read ${NAME_MASK} as a season.`);
  });
});

describe('reviewCardState — карточка «Повторение» в шапке курса (спека 45, раздел В)', () => {
  const sum = (p: Partial<ReviewSummary> = {}): ReviewSummary => ({ deckSize: 8, due: 0, newAvailable: 0, dueTomorrow: 0, ...p });

  it('колода пуста → hidden, какими бы ни были остальные числа', () => {
    expect(reviewCardState(sum({ deckSize: 0, due: 3, newAvailable: 2 }))).toBe('hidden');
  });
  it('просроченные важнее новых → due', () => {
    expect(reviewCardState(sum({ due: 2, newAvailable: 5 }))).toBe('due');
  });
  it('просроченных нет, новые есть → new', () => {
    expect(reviewCardState(sum({ newAvailable: 1 }))).toBe('new');
  });
  it('ни просроченных, ни новых → done (даже при dueTomorrow 0)', () => {
    expect(reviewCardState(sum({ dueTomorrow: 4 }))).toBe('done');
    expect(reviewCardState(sum())).toBe('done');
  });
});

describe('nextSessionSize — число в ссылке «Ещё N»', () => {
  const sum = (p: Partial<ReviewSummary> = {}): ReviewSummary => ({ deckSize: 20, due: 0, newAvailable: 0, dueTomorrow: 0, ...p });

  it('просроченные + доступные новые, потолок SESSION_MAX, ноль при пустой сводке', () => {
    expect(nextSessionSize(sum({ due: 3, newAvailable: 4 }))).toBe(7);
    expect(nextSessionSize(sum({ due: 8, newAvailable: 8 }))).toBe(SESSION_MAX);
    expect(nextSessionSize(sum())).toBe(0);
  });

  it('обещает ровно столько карт, сколько соберёт buildSession на той же сводке', () => {
    // 12 карт: c1..c3 просрочены, остальные новые; сегодня новых введено 8 → доступно 2
    const d = deck(12);
    const srs = overdue(3);
    const day = { date: T, newCount: 8, doneCount: 0 };
    const s = reviewSummary(d, srs, T, day);
    expect(nextSessionSize(s)).toBe(5);
    expect(buildSession(d, srs, T, day, lcg(1)).length).toBe(nextSessionSize(s));
    // без дневного лимита упирается в SESSION_MAX — и там тоже совпадает
    const s2 = reviewSummary(d, srs, T, REVIEW_DAY_DEFAULT);
    expect(buildSession(d, srs, T, REVIEW_DAY_DEFAULT, lcg(2)).length).toBe(nextSessionSize(s2));
    expect(nextSessionSize(s2)).toBe(SESSION_MAX);
  });
});

describe('doneCount — карты, покинувшие очередь за день (спека 53)', () => {
  const T = '2026-08-22';
  it('оценка «помню» по карте к повторению увеличивает doneCount на 1', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 2, T);
    expect(r.day).toEqual({ date: T, newCount: 1, doneCount: 1 });
  });
  it('«не помню» doneCount не трогает — карта вернётся в ту же порцию', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 0, T);
    expect(r.day.doneCount).toBe(0);
    // …а следом «помню» по той же карте считает её один раз
    const r2 = applyReview(r.srs, r.day, 'fool', 2, T);
    expect(r2.day.doneCount).toBe(1);
  });
  it('повторное «помню» карты, уже ушедшей на завтра, не считается', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 2, T);
    const r2 = applyReview(r.srs, r.day, 'fool', 3, T);
    expect(r2.day.doneCount).toBe(1);
  });
  it('новый день обнуляет счётчик', () => {
    const day: ReviewDay = { date: '2026-08-21', newCount: 3, doneCount: 7 };
    expect(doneToday(day, T)).toBe(0);
    const r = applyReview({}, day, 'fool', 2, T);
    expect(r.day).toEqual({ date: T, newCount: 1, doneCount: 1 });
  });
  it('mergeReviewDay доливает doneCount старой записи и не трогает полную', () => {
    expect(mergeReviewDay({ date: T, newCount: 4 })).toEqual({ date: T, newCount: 4, doneCount: 0 });
    expect(mergeReviewDay({ date: T, newCount: 4, doneCount: 2 })).toEqual({ date: T, newCount: 4, doneCount: 2 });
    expect(mergeReviewDay(undefined)).toEqual(REVIEW_DAY_DEFAULT);
    expect(mergeReviewDay(null)).toEqual(REVIEW_DAY_DEFAULT);
  });
});
