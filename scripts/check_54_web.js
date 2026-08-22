/* Веб-проверка задачи 54 (пункты 6а/6б процесса): ссылки пейвола и «О приложении» ведут
   на публичные страницы, дисклеймер онбординга виден на первом шаге.
   Запуск: dev-сервер `npx expo start --web --clear`, затем
   NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node scripts/check_54_web.js
   ⚠️ Сид состояния ставится через goto → evaluate → reload (addInitScript затирает состояние
   на каждой навигации — урок задач 45/53). */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:8081';
const OUT = 'docs/screenshots/54';
const SITE = 'https://sivyankof.github.io/arcanum';

let checks = 0, fails = 0;
const say = (ok, msg) => { checks++; if (!ok) fails++; console.log((ok ? 'OK   ' : 'FAIL ') + msg); };

/* Состояние стора: ключи ВЕРХНЕГО уровня (`themeMode`, `lang`, `profile`) — форма та же,
   что в scripts/check_53_web.js; persist version 11. */
function seedState(lang, theme, extra) {
  return JSON.stringify({
    state: Object.assign({
      themeMode: theme,
      lang,
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: { active: false, source: 'none' },
      xp: 400,
      streak: 5,
    }, extra || {}),
    version: 11,
  });
}

/** Ставит состояние и открывает путь (goto → evaluate → reload — урок задач 45/53). */
async function open(page, route, state) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return page.url().replace(BASE, '');
}

/** Перехват открытия внешних ссылок: и window.open, и клик по <a href>. */
async function armOpenSpy(page) {
  await page.evaluate(() => {
    window.__opened = [];
    if (!window.__spyArmed) {
      window.__spyArmed = true;
      const realOpen = window.open;
      window.open = (u) => { window.__opened.push(String(u)); return null; };
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (a) { window.__opened.push(a.href); e.preventDefault(); }
      }, true);
    }
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    // ── Пейвол: юридические ссылки ведут на web-URL, а не на «О приложении» ──
    let url = await open(page, '/paywall', seedState('ru', theme));
    say(url === '/paywall', `${theme}/пейвол: маршрут открылся (${url})`);

    const terms = page.getByText('Условия', { exact: true }).first();
    const privacy = page.getByText('Конфиденциальность', { exact: true }).first();
    say(await terms.count() > 0, `${theme}/пейвол: ссылка «Условия» есть`);
    say(await privacy.count() > 0, `${theme}/пейвол: ссылка «Конфиденциальность» есть`);
    await page.screenshot({ path: `${OUT}/paywall-${theme}.png` });

    await armOpenSpy(page);
    await terms.click({ force: true });
    await page.waitForTimeout(600);
    let opened = await page.evaluate(() => window.__opened || []);
    say(opened.some((u) => u.includes('/terms.html')),
      `${theme}/пейвол: «Условия» → terms.html (открыто: ${JSON.stringify(opened)})`);
    say(!page.url().includes('/about'),
      `${theme}/пейвол: «Условия» НЕ уводит на экран «О приложении» (url ${page.url().replace(BASE, '')})`);

    await page.evaluate(() => { window.__opened = []; });
    await privacy.click({ force: true });
    await page.waitForTimeout(600);
    opened = await page.evaluate(() => window.__opened || []);
    say(opened.some((u) => u.includes('/privacy.html')),
      `${theme}/пейвол: «Конфиденциальность» → privacy.html (открыто: ${JSON.stringify(opened)})`);

    // ── «О приложении»: три ссылки + новый текст политики ──
    url = await open(page, '/about', seedState('ru', theme));
    say(url === '/about', `${theme}/о приложении: маршрут открылся (${url})`);
    const body = await page.evaluate(() => document.body.innerText);
    say(body.includes('RevenueCat'), `${theme}/о приложении: политика упоминает RevenueCat (Д4)`);
    say(body.includes('аналитики и рекламы'), `${theme}/о приложении: политика говорит про отсутствие аналитики`);
    say(body.includes('Открыть политику в браузере'), `${theme}/о приложении: ссылка на политику`);
    say(body.includes('Открыть условия в браузере'), `${theme}/о приложении: ссылка на условия`);
    say(body.includes('Страница поддержки'), `${theme}/о приложении: ссылка на поддержку`);
    await page.screenshot({ path: `${OUT}/about-${theme}.png`, fullPage: true });

    await armOpenSpy(page);
    await page.getByText('Открыть политику в браузере').first().click({ force: true });
    await page.waitForTimeout(600);
    opened = await page.evaluate(() => window.__opened || []);
    say(opened.some((u) => u.startsWith(SITE) && u.includes('privacy.html')),
      `${theme}/о приложении: ссылка ведёт на ${SITE}/privacy.html (открыто: ${JSON.stringify(opened)})`);

    await page.evaluate(() => { window.__opened = []; });
    await page.getByText('Страница поддержки').first().click({ force: true });
    await page.waitForTimeout(600);
    opened = await page.evaluate(() => window.__opened || []);
    say(opened.some((u) => u.includes('support.html')),
      `${theme}/о приложении: «Страница поддержки» → support.html (открыто: ${JSON.stringify(opened)})`);

    // ── Онбординг: дисклеймер на первом шаге, все четыре языка ──
    for (const lang of ['ru', 'en', 'es', 'pt']) {
      const u2 = await open(page, '/onboarding',
        seedState(lang, theme, { profile: { onboarded: false } }));
      say(u2 === '/onboarding', `${theme}/онбординг ${lang}: экран открылся (${u2})`);
      const t = await page.evaluate(() => document.body.innerText);
      const marker = { ru: 'не предсказывает будущее', en: 'does not predict the future',
                       es: 'no predice el futuro', pt: 'não prevê o futuro' }[lang];
      say(t.includes(marker), `${theme}/онбординг ${lang}: дисклеймер виден («${marker}»)`);
      if (lang === 'ru') {
        const btn = page.getByText('НАЧАТЬ ПУТЬ').first();
        const box = await btn.boundingBox();
        say(!!box && box.y + box.height <= 844,
          `${theme}/онбординг: кнопка в пределах экрана (низ ${box && Math.round(box.y + box.height)}px)`);
        const dis = page.getByText(marker).first();
        const dbox = await dis.boundingBox();
        say(!!dbox && dbox.y + dbox.height <= 844,
          `${theme}/онбординг: дисклеймер целиком в пределах экрана (низ ${dbox && Math.round(dbox.y + dbox.height)}px)`);
        await page.screenshot({ path: `${OUT}/onboarding-${theme}.png` });
      }
    }

    say(errors.length === 0, `${theme}: консоль без ошибок (${errors.slice(0, 2).join(' | ')})`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nИТОГО: ${checks - fails} из ${checks}`);
  process.exit(fails ? 1 : 0);
})();
