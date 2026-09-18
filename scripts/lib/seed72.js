/* Общее для веб-проверки и скриншотов курса/задачи 72 (правка финального ревью, находка F12):
   PREMIUM_NONE/progress()/списки уроков M1…M6/ALL32/seed() были продублированы дословно
   в check_72_web.js и shoot_72.js; themeHex/hexToRgb — своей копией в shoot_63.js. Списки уроков
   читаются из content/course.json (тот же приём, что MODULE1_IDS в shoot_63.js), а не литералом:
   правка состава модулей курса не должна расходиться по нескольким копиям молча. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const modules = require(path.join(ROOT, 'content/course.json')).modules;
const THEME_TS = fs.readFileSync(path.join(ROOT, 'src/theme/theme.ts'), 'utf8');
const XP_TS = fs.readFileSync(path.join(ROOT, 'src/lib/xp.ts'), 'utf8');

const PREMIUM_NONE = { active: false, source: 'none', until: null, plan: null, willRenew: false };

/** Карта id уроков → «пройден» для сидов lessonsProgress. */
function progress(ids) {
  return Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));
}

const MODULE_LESSON_IDS = modules.map((m) => m.lessons.map((l) => l.id));
const [M1, M2, M3, M4, M5, M6] = MODULE_LESSON_IDS;
const M12 = [...M1, ...M2];
const ALL32 = MODULE_LESSON_IDS.flat();

/** JSON-сид localStorage под ключ arcanum-app (persist version 12, спека 53б: `premium` несёт
 *  `plan`/`willRenew`). themeMode по умолчанию 'dark' — единственное явное поле сверх остальных
 *  полей стора, которые вызывающий передаёт через `extra`. */
function seed({ themeMode = 'dark', ...extra } = {}) {
  return JSON.stringify({
    state: {
      themeMode,
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: PREMIUM_NONE,
      lessonsProgress: {},
      srs: {},
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: [],
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 12,
  });
}

/** hex-цвет темы из первоисточника токенов theme.ts (приём shoot_63.js): вырезает блок
 *  `export const <name>: Theme = {…}` до следующего `export const` и ищет в нём `<key>: '#rrggbb'`. */
function themeHex(name, key) {
  const start = THEME_TS.search(new RegExp(`^export const ${name}: Theme = \\{`, 'm'));
  if (start < 0) throw new Error(`нет темы ${name} в theme.ts`);
  const rest = THEME_TS.slice(start + 1);
  const nextRel = rest.search(/^export const /m);
  const chunk = THEME_TS.slice(start, nextRel < 0 ? undefined : start + 1 + nextRel);
  const m = chunk.match(new RegExp(`\\b${key}: '(#[0-9a-fA-F]{6})'`));
  if (!m) throw new Error(`ключа ${key} нет в теме ${name} (theme.ts)`);
  return m[1];
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
/** rgb() цвета темы — themeHex + hexToRgb одним вызовом. */
function themeRgb(name, key) {
  return hexToRgb(themeHex(name, key));
}

/** XP_REVIEW из первоисточника (src/lib/xp.ts), а не хардкод рядом со сравнением в проверке. */
const XP_REVIEW_MATCH = XP_TS.match(/export const XP_REVIEW = (\d+);/);
if (!XP_REVIEW_MATCH) throw new Error('не удалось прочитать XP_REVIEW из src/lib/xp.ts');
const XP_REVIEW = Number(XP_REVIEW_MATCH[1]);

module.exports = {
  PREMIUM_NONE, progress, M1, M12, M3, M4, M5, M6, ALL32, seed,
  themeHex, hexToRgb, themeRgb, XP_REVIEW,
};
