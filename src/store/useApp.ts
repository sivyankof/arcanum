/** Глобальное состояние: тема, язык, карта дня, серия (streak). Персист — AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PERSIST_DEFAULTS, resolveImportedLang, SCHEMA_VERSION, type BackupState } from '../lib/backup';
import { birthArcanaId, buildProfile, type Profile } from '../lib/birthArcana';
import { course } from '../lib/content';
import { completeLessonProgress, learnedCardIds, newlyLearnedIds, type LessonProgressMap } from '../lib/courseProgress';
import { daysAgoISO, localDateISO, plusDaysISO } from '../lib/dates';
import { deviceLocaleTags } from '../lib/deviceLang';
import { AVAILABLE_LANGS } from '../lib/i18n';
import { canEditEntry, HISTORY_MAX, normalizeNote, type DailyDraw, type Outcome } from '../lib/journal';
import { detectLang, type Lang } from '../lib/lang';
import { applyReview, REVIEW_DAY_DEFAULT, type ReviewDay, type SrsMap } from '../lib/review';
import { queueReveal } from '../lib/revealQueue';
import { mergeSettings, type AppSettings } from '../lib/settings';
import { SPREADS_MAX, type SpreadDraw } from '../lib/spread';
import { EASE_START, type SrsGrade } from '../lib/srs';
import { advanceStreak, FREEZE_MAX, grantFreezes } from '../lib/streak';
import { reflectXp, XP_DRAW, XP_SPREAD } from '../lib/xp';
import type { ThemeMode } from '../theme/theme';

// тип языка живёт в src/lib/lang.ts рядом со словарями и детекцией; здесь — реэкспорт
export type { Lang };

// тип записи живёт в src/lib/journal.ts вместе с чистой арифметикой дневника,
// здесь — только реэкспорт, чтобы экраны импортировали его привычным путём
export type { DailyDraw };

// сами настройки (тип, дефолт, слияние при обновлении) живут в src/lib/settings.ts —
// реэкспорт типа, чтобы экраны не меняли импорты
export type { AppSettings };

// прогресс уроков курса — тип живёт в src/lib/courseProgress.ts рядом с логикой пути
export type { LessonProgressMap };

// профиль (имя, дата и аркан рождения) — тип живёт в src/lib/birthArcana.ts рядом с формулой
export type { Profile };

export interface AppState {
  themeMode: ThemeMode;
  lang: Lang;
  /** Личный сид для карты дня (0 — ещё не назначен, назначается один раз после первой гидрации). */
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  /** Заморозки серии (logic-spec §2, спека 10): запас (0..FREEZE_MAX), месяц последнего
   *  начисления ('YYYY-MM', null до первой синхронизации) и день последней траты —
   *  по нему «Сегодня» весь день спасения показывает строку «Серию спасла заморозка». */
  freezes: number;
  freezeMonth: string | null;
  freezeSpentDate: string | null;
  history: DailyDraw[];
  /** Сохранённые расклады (спека 36, logic-spec §7): новые сверху, не больше SPREADS_MAX.
   *  Несохранённый черновик сюда не попадает никогда — он живёт только в состоянии экрана. */
  spreadsHistory: SpreadDraw[];
  /** Прогресс уроков курса по id урока (logic-spec §7). В 07 читается для состояний
   *  узлов пути; пишут только DEV-строки настроек — настоящая запись в задаче 08. */
  lessonsProgress: LessonProgressMap;
  /** Сумма XP (logic-spec §4). Источники: урок, повтор урока, карта дня, первый ответ
   *  рефлексии дня. Задним числом за прошлые дни не начисляется — счёт с нуля у всех. */
  xp: number;
  /** Повторение изученных карт (спека 45, logic-spec §12): состояние SM-2 по cardId (карта
   *  без записи — новая) и счётчик новых карт за день. Колода не хранится — она считается
   *  из lessonsProgress (deckOrder). */
  srs: SrsMap;
  reviewDay: ReviewDay;
  settings: AppSettings;
  /** Профиль онбординга (logic-spec §7): имя, дата и аркан рождения.
   *  onboarded: false — онбординг ещё не пройден, корневой layout уводит на /onboarding. */
  profile: Profile;
  /** Только для разработки: показать блок рефлексии, не дожидаясь 18:00. */
  devReflect: boolean;
  /** Только для разработки: считать окно лунного расклада открытым (спека 51) — «сейчас»
   *  подменяется моментом ближайшего события, см. useDevMoonNow. */
  devMoonOpen: boolean;
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  drawToday: (cardId: string, reversed: boolean) => void;
  todayDraw: () => DailyDraw | undefined;
  setNote: (date: string, text: string) => void;
  setOutcome: (date: string, outcome: Outcome) => void;
  /** Сохранение расклада в дневник (спека 36): +5 XP; повтор того же ts ничего не пишет.
   *  Возвращает void, а не начисленный XP (как completeLesson): у экрана расклада нет своего
   *  «результата» вроде LessonResult — единственный вызов результат не читает, а идемпотентность
   *  живёт внутри самого экшена (проверка spreadsHistory по ts), звать наружу её незачем. */
  saveSpread: (draw: SpreadDraw) => void;
  setLessonDone: (lessonId: string, done: boolean) => void;
  /** Завершение урока движком (спека 08). Возвращает начисленный XP для экрана результата. */
  completeLesson: (lessonId: string, errors: number) => number;
  /** Оценка карты в тренажёре: SM-2 + счётчик новых + XP по правилу applyReview; возвращает
   *  начисленный XP (0 или XP_REVIEW). */
  reviewCard: (cardId: string, grade: SrsGrade) => number;
  /** DEV: обнулить повторение (состояния и счётчик дня). */
  resetSrs: () => void;
  /** DEV: «состарить» повторение на день — все due на сутки назад, счётчик новых сброшен;
   *  без этого «ждут завтра» и дневной лимит новых проверяются только календарём. */
  devAgeSrs: () => void;
  /** DEV: рассадить изученным картам ступени мастерства по кругу (спека 49) — без этого
   *  УВЕРЕННАЯ и МАСТЕР недостижимы на проверке раньше чем через 6/21 день повторений. */
  devSeedMastery: () => void;
  resetCourse: () => void;
  setReflectionOn: (on: boolean) => void;
  setPushesOn: (on: boolean) => void;
  setPushTime: (kind: 'morning' | 'evening', hhmm: string) => void;
  setPushAsked: () => void;
  /** Финальная CTA онбординга: профиль пишется одним куском (buildProfile). */
  completeOnboarding: (name: string, birthDate?: string) => void;
  /** Дата рождения, пропущенная в онбординге, — из карточки-приглашения профиля (спека 16).
   *  Заполняет СУЩЕСТВУЮЩИЕ опциональные поля profile — persist version не меняется. */
  setBirthDate: (iso: string) => void;
  /** Только для разработки: вернуть онбординг — гард в _layout сам уведёт на экран. */
  resetOnboarding: () => void;
  setDevReflect: (on: boolean) => void;
  setDevMoonOpen: (on: boolean) => void;
  resetToday: () => void;
  /** Ленивое начисление заморозок: зовётся на гидрации и при возврате из фона. */
  syncFreezeGrant: () => void;
  /** Только для разработки: симулирует пропущенный вчера день. */
  devSkipYesterday: () => void;
  /** Импорт бэкапа (спека 11): полная замена персистуемых данных. Сюда приходит
   *  УЖЕ валидированное состояние — файл разбирает parseBackup. */
  restoreBackup: (s: BackupState) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      // дефолты персистуемой схемы лежат в backup.ts (PERSIST_DEFAULTS): бэкап по построению
      // совпадает с тем, что персистится, и доливает старые файлы теми же значениями
      ...PERSIST_DEFAULTS,
      devReflect: false,
      devMoonOpen: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setLang: (lang) => set({ lang }),

      drawToday: (cardId, reversed) => {
        const t = localDateISO();
        const { lastDrawDate, streak, freezes, history, xp } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        // вся арифметика серии и заморозки — в чистом advanceStreak (streak.ts)
        const adv = advanceStreak({ streak, lastDrawDate, freezes }, t);
        set({
          lastDrawDate: t,
          streak: adv.streak,
          freezes: adv.freezes,
          ...(adv.freezeSpent ? { freezeSpentDate: t } : {}),
          history: [{ date: t, cardId, reversed }, ...history].slice(0, HISTORY_MAX),
          // ритуал дня: +5 XP (logic-spec §4); повторное начисление отсекает проверка выше
          xp: xp + XP_DRAW,
        });
      },

      todayDraw: () => get().history.find((h) => h.date === localDateISO()),

      // Заметка к карте дня. Правится только сегодняшняя запись (logic-spec §3: в полночь
      // запись фиксируется). Пустой текст удаляет поле, а не пишет пустую строку.
      setNote: (date, text) => {
        if (!canEditEntry(date)) return;
        const note = normalizeNote(text);
        set({
          history: get().history.map((h) => {
            if (h.date !== date) return h;
            const { note: _prev, ...rest } = h;
            return note ? { ...rest, note } : rest;
          }),
        });
      },

      // Ответ вечерней рефлексии. Правило то же, что у заметки: правится только сегодняшняя
      // запись (logic-spec §3). Смена ответа до полуночи разрешена, снятия ответа нет.
      // +3 XP — только за ПЕРВЫЙ ответ дня: смена ответа повторно не начисляет (logic-spec §4).
      setOutcome: (date, outcome) => {
        if (!canEditEntry(date)) return;
        const entry = get().history.find((h) => h.date === date);
        if (!entry || entry.outcome === outcome) return;
        set({
          history: get().history.map((h) => (h.date === date ? { ...h, outcome } : h)),
          xp: get().xp + reflectXp(entry.outcome),
        });
      },

      // Сохранение расклада (спека 36). Идемпотентно по ts: двойной тап по «Сохранить» и повторный
      // вызов из-за перерисовки не должны дублировать запись и XP. Срез до SPREADS_MAX — как history.
      saveSpread: (draw) => {
        const { spreadsHistory, xp } = get();
        if (spreadsHistory.some((s) => s.ts === draw.ts)) return;
        set({ spreadsHistory: [draw, ...spreadsHistory].slice(0, SPREADS_MAX), xp: xp + XP_SPREAD });
      },

      // Прогресс урока. До движка урока (08) сюда пишут только DEV-строки настроек;
      // errors всегда 0 — считать их научит викторина задачи 08.
      setLessonDone: (lessonId, done) =>
        set({
          lessonsProgress: {
            ...get().lessonsProgress,
            [lessonId]: { done, errors: 0, ts: Date.now() },
          },
        }),
      // Завершение урока: вся арифметика — в чистой completeLessonProgress (courseProgress.ts),
      // экшен применяет результат и возвращает начисленный XP экрану результата.
      completeLesson: (lessonId, errors) => {
        const { lessonsProgress, xp } = get();
        const r = completeLessonProgress(lessonsProgress, lessonId, errors, localDateISO(), Date.now());
        // впервые изученные карты — в очередь «момента переворота» справочника (спека 46в);
        // урок-повторение и уроки без карт дают пустую разницу, очередь не трогается
        const fresh = newlyLearnedIds(course, lessonsProgress, r.progress);
        if (fresh.length) queueReveal(fresh);
        set({ lessonsProgress: r.progress, xp: xp + r.gained });
        return r.gained;
      },
      resetCourse: () => set({ lessonsProgress: {} }),

      // Тренажёр (спека 45): вся арифметика — в чистой applyReview (review.ts), стор применяет
      // результат и отдаёт начисленный XP экрану (тот же приём, что completeLesson).
      reviewCard: (cardId, grade) => {
        const { srs, reviewDay, xp } = get();
        const r = applyReview(srs, reviewDay, cardId, grade, localDateISO());
        set({ srs: r.srs, reviewDay: r.day, xp: xp + r.gained });
        return r.gained;
      },
      resetSrs: () => set({ srs: {}, reviewDay: REVIEW_DAY_DEFAULT }),
      devAgeSrs: () =>
        set({
          srs: Object.fromEntries(
            Object.entries(get().srs).map(([id, s]) => [id, { ...s, due: plusDaysISO(s.due, -1) }]),
          ),
          reviewDay: REVIEW_DAY_DEFAULT,
        }),
      devSeedMastery: () => {
        const learned = [...learnedCardIds(course, get().lessonsProgress)];
        const today = localDateISO();
        // ступени по кругу: без записи (НОВАЯ) / интервал 1 / 6 / 21; due в будущем,
        // чтобы после рассадки очередь тренажёра не наводнялась «просроченными»
        const plans = [null, { reps: 1, iv: 1 }, { reps: 2, iv: 6 }, { reps: 3, iv: 21 }] as const;
        const srs: SrsMap = { ...get().srs };
        learned.forEach((id, i) => {
          const p = plans[i % plans.length];
          if (!p) delete srs[id];
          else srs[id] = { reps: p.reps, intervalDays: p.iv, ease: EASE_START, due: plusDaysISO(today, p.iv) };
        });
        set({ srs });
      },

      setReflectionOn: (on) => set({ settings: { ...get().settings, reflectionOn: on } }),
      setPushesOn: (on) => set({ settings: { ...get().settings, pushesOn: on } }),
      setPushTime: (kind, hhmm) =>
        set({
          settings: {
            ...get().settings,
            ...(kind === 'morning' ? { pushMorning: hhmm } : { pushEvening: hhmm }),
          },
        }),
      setPushAsked: () => set({ settings: { ...get().settings, pushAsked: true } }),
      completeOnboarding: (name, birthDate) => set({ profile: buildProfile(name, birthDate) }),
      setBirthDate: (iso) =>
        set({
          profile: { ...get().profile, birthDate: iso, birthArcanaId: birthArcanaId(iso) },
        }),
      resetOnboarding: () => set({ profile: { onboarded: false } }),
      setDevReflect: (devReflect) => set({ devReflect }),
      setDevMoonOpen: (devMoonOpen) => set({ devMoonOpen }),

      // Для разработки: отменяет сегодняшнюю карту, чтобы вытянуть заново.
      // Серия уменьшается на 1 (точное прежнее значение не хранится).
      resetToday: () => {
        const t = localDateISO();
        const { history, streak, freezes, freezeSpentDate } = get();
        if (!history.some((h) => h.date === t)) return;
        const rest = history.filter((h) => h.date !== t);
        set({
          history: rest,
          lastDrawDate: rest[0]?.date ?? null,
          streak: Math.max(0, streak - 1),
          // сегодняшняя трата возвращается — иначе каждый DEV-сброс сжигал бы заморозку
          ...(freezeSpentDate === t
            ? { freezes: Math.min(FREEZE_MAX, freezes + 1), freezeSpentDate: null }
            : {}),
        });
      },

      // Ленивое «1-е число месяца»: фоновых задач нет, поэтому начисление происходит при
      // первом открытии приложения в новом месяце — из onRehydrateStorage (холодный старт)
      // и по возврату из фона (app/_layout.tsx, useAppActive). Пустой set не делаем.
      syncFreezeGrant: () => {
        const { freezes, freezeMonth } = get();
        const next = grantFreezes({ freezes, freezeMonth }, localDateISO());
        if (next.freezes !== freezes || next.freezeMonth !== freezeMonth) set(next);
      },

      // Импорт бэкапа (спека 11): полная замена. Persist сам записывает новое состояние,
      // план пушей пересчитывает подписка usePushScheduler, тему применяют существующие
      // подписки. Язык — тоже восстанавливаемая настройка, как тема (спека 27, волна фиксов
      // финального ревью: раньше здесь стоял комментарий «язык не трогаем», спека и logic-spec
      // §7 ему верили, а код уже применял язык из файла — прав оказался код, неправа спека),
      // но с ограничителем: resolveImportedLang берёт язык файла, только если он есть среди
      // AVAILABLE_LANGS текущей сборки, иначе оставляет язык, уже действующий на устройстве —
      // здесь и два шага гигиены.
      restoreBackup: (s) => {
        set({
          ...s,
          lang: resolveImportedLang(s.lang, get().lang, AVAILABLE_LANGS),
          // очень старый или правленный руками файл мог прийти без сида —
          // назначаем свежий, как это делает onRehydrateStorage после гидрации
          ...(s.installSeed === 0
            ? { installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)) }
            : {}),
        });
        // бэкап прошлого месяца сразу доначисляет заморозку нового, не ожидая перезапуска
        get().syncFreezeGrant();
      },

      // Только для разработки: «вчера пропущен» — lastDrawDate уезжает на позавчера,
      // сегодняшняя запись стирается. Следующий переворот карты либо тратит заморозку,
      // либо (freezes === 0) сбрасывает серию — иначе механику не проверить, не ждя сутки.
      // ⚠️ В отличие от resetToday, заморозку, потраченную СЕГОДНЯ, эта симуляция НЕ возвращает —
      // осознанно: только очищает флаг freezeSpentDate. Повторный прогон сценария (сразу за первым)
      // идёт с уже нулевым запасом, и этим проверяется ветка сброса серии при freezes === 0.
      devSkipYesterday: () => {
        const t = localDateISO();
        set({
          history: get().history.filter((h) => h.date !== t),
          lastDrawDate: daysAgoISO(2),
          freezeSpentDate: null,
        });
      },
    }),
    {
      name: 'arcanum-app',
      // ⚠️ БИТУЮ запись считаем отсутствующей. С задачи 09 первый экран ждёт завершения
      // гидрации (гейт онбординга в app/_layout.tsx), а zustand на ошибке разбора НЕ поднимает
      // hasHydrated и не зовёт слушателей вовсе — приложение осталось бы на сплэше навсегда,
      // и починить это можно было бы только переустановкой, то есть потерей дневника.
      // Раньше та же порча просто означала старт с дефолтов; возвращаем это поведение.
      // Глотаем ТОЛЬКО ошибку разбора: сбои доступа к самому хранилищу пробрасываем как прежде —
      // на вебе expo-router рендерит страницы ещё и в Node (output: "static"), где AsyncStorage
      // падает на отсутствии window, и подменять там гидрацию дефолтами нельзя: серверный кадр
      // тогда покажет онбординг всем подряд, включая тех, кто его давно прошёл.
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const raw = await AsyncStorage.getItem(name);
          if (raw === null) return null;
          try {
            JSON.parse(raw); // проверка читаемости: сам разбор идёт дальше в createJSONStorage
          } catch {
            return null;
          }
          return raw;
        },
        setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
        removeItem: (name: string) => AsyncStorage.removeItem(name),
      })),
      // schemaVersion из logic-spec §7 хранится тут же, отдельного поля в состоянии нет.
      // v1 → v2: появились настройки (settings.reflectionOn).
      // v2 → v3: настройки пушей (pushesOn, pushMorning, pushEvening, pushAsked).
      // v3 → v4: lessonsProgress (прогресс курса, спека 07). Ключ ВЕРХНЕГО уровня —
      // поверхностное слияние persist подставит дефолт {} само (ловушка 06а бьёт только
      // по вложенным объектам вроде settings), поэтому отдельная ветка миграции не нужна.
      // v4 → v5: xp (спека 08) — снова ключ ВЕРХНЕГО уровня, дефолт 0 доливается поверхностным
      // слиянием сам; repeatDate живёт ВНУТРИ записей lessonsProgress и опционален — миграция
      // не нужна.
      // v5 → v6: profile (спека 09) — снова ключ ВЕРХНЕГО уровня, дефолт { onboarded: false }
      // доливается поверхностным слиянием сам, ветка миграции не нужна. Существующие установки
      // получают onboarded: false и проходят онбординг один раз (решение Артёма 13.08).
      // ⚠️ Но profile — ВТОРОЙ вложенный объект состояния после settings, и ловушка 06а
      // распространяется на него целиком: задача, которая добавит ПОЛЕ ВНУТРЬ profile,
      // обязана поднять версию И дописать слияние руками в migrate — как это сделано
      // для settings. Само по себе новое поле у уже установленного приложения не появится.
      // Задача 16 (профиль = эталон) кандидатом на этот бамп числилась, но обошлась без него:
      // «дату предложим позже» пишет экшен setBirthDate в УЖЕ объявленные опциональные поля
      // birthDate/birthArcanaId, новых ключей схемы не появилось. Правило выше от этого не
      // ослабло — просто здесь оно не сработало.
      // v6 → v7: freezes/freezeMonth/freezeSpentDate (спека 10) — снова ключи ВЕРХНЕГО уровня,
      // дефолты (1/null/null) доливаются поверхностным слиянием сами, ветка миграции не нужна.
      // Существующие пользователи получают freezes: 1 сразу (решение 2 спеки 10).
      // v7 → v8: домен `lang` расширен до ru/en/es/pt (спека 27) — форма не менялась, миграции нет.
      // v8 → v9: spreadsHistory (спека 36) — ключ ВЕРХНЕГО уровня, дефолт [] доливается
      // поверхностным слиянием, ветка миграции не нужна.
      // v9 → v10: srs и reviewDay (спека 45) — ключи ВЕРХНЕГО уровня, дефолты {} и
      // {date: '', newCount: 0} доливаются поверхностным слиянием, ветка миграции не нужна.
      // ⚠️ reviewDay — вложенный объект: задача, добавляющая поле ВНУТРЬ него, обязана поднять
      // версию и дописать слияние руками (ловушка 06а). Следующая задача, меняющая схему,
      // поднимает до 11.
      // Значение живёт в src/lib/backup.ts (SCHEMA_VERSION): им же parseBackup отсекает
      // файлы из более новых версий приложения. Поднимать — там.
      version: SCHEMA_VERSION,
      // ⚠️ persist сливает состояние ПОВЕРХНОСТНО: сохранённый `settings` заменяет объект-дефолт
      // целиком, а не сливается с ним по ключам. Поэтому недостающие ключи дописываем здесь
      // руками — и следующая задача, добавляя поля в settings, обязана поднять версию и сделать
      // то же самое, иначе новые настройки не появятся у уже существующих пользователей.
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<AppState>;
        return { ...s, settings: mergeSettings(s.settings) } as AppState;
      },
      // После гидрации назначаем личный сид карты дня, если он ещё не назначен (installSeed === 0):
      // срабатывает и на свежей установке, и у уже существующих пользователей после обновления.
      // Уже открытая сегодня карта не изменится — она читается из history, а не пересчитывается.
      // Здесь же — язык первой установки (спека 27): снимок с устройства среди доступных языков,
      // дальше язык свой (пикер в настройках, а также restoreBackup — с ограничителем по
      // доступным языкам, см. комментарий там). Существующие установки сюда не попадают (сид
      // уже есть). Дефолт `lang: 'ru'` в PERSIST_DEFAULTS — только доливка старого файла без
      // поля, настоящий первый язык назначается тут.
      onRehydrateStorage: () => (state) => {
        if (state && state.installSeed === 0) {
          useApp.setState({
            installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)),
            lang: detectLang(deviceLocaleTags(), AVAILABLE_LANGS),
          });
        }
        // холодный старт в новом месяце — момент «1-го числа» для начисления заморозки;
        // возврат из фона ловит useAppActive в app/_layout.tsx.
        // Начисление ТОЛЬКО при удавшейся гидрации: state === undefined значит SSR-рендер веба
        // (expo-router рендерит страницы ещё и в Node, у AsyncStorage там нет window — запись
        // бросает и роняет процесс) или битую запись — начислять нечего и писать в хранилище
        // нельзя. Свежая установка сюда не попадает: у неё state есть (дефолты), как у installSeed.
        if (state) useApp.getState().syncFreezeGrant();
      },
    },
  ),
);

// Контроль полноты бэкапа на уровне типов (спека 11): каждое НЕ-функциональное поле
// состояния обязано быть либо в белом списке бэкапа (BackupState), либо явно причислено
// к dev-полям. Добавили поле в стор и не решили судьбу его бэкапа — не соберётся tsc,
// а имя забытого поля будет прямо в тексте ошибки.
// ⚠️ Тип-контроль заставит внести поле в белый список, но НЕ потребует ветку в validState
// (src/lib/backup.ts) — новое поле без неё уедет в бэкап невалидируемым: решать при
// добавлении поля, а не полагаться, что tsc поймает и это тоже (волна фиксов, spec 11).
type DataKeys = {
  [K in keyof AppState]: AppState[K] extends (...args: never[]) => unknown ? never : K;
}[keyof AppState];
type OutsideBackup = Exclude<DataKeys, keyof BackupState | 'devReflect' | 'devMoonOpen'>;
const backupCovers: OutsideBackup extends never ? true : OutsideBackup = true;
void backupCovers;
