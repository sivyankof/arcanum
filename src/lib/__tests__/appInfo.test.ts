/** Адрес оценки приложения (задача 71, спека 74): Android — market://, iOS — только после публикации
 *  (до неё ссылки на страницу отзывов нет), прочие платформы — без строки. Идентификаторы сверяются
 *  с конфигами сборки, чтобы код не разошёлся с app.json / eas.json. */
import fs from 'fs';
import path from 'path';
import {
  ANDROID_PACKAGE,
  IOS_APP_ID,
  RATE_WEB_URL,
  rateUrlFor,
} from '../appInfo';

const ROOT = path.join(__dirname, '../../..');
const readJson = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));

describe('rateUrlFor', () => {
  it('android — market://', () => {
    expect(rateUrlFor('android')).toBe('market://details?id=app.arcanum.tarot');
  });

  it('ios до публикации — null', () => {
    expect(rateUrlFor('ios', false)).toBeNull();
  });

  it('ios после публикации — страница отзывов App Store', () => {
    expect(rateUrlFor('ios', true)).toBe(
      'itms-apps://itunes.apple.com/app/viewContentsUserReviews/id6805994267?action=write-review',
    );
  });

  it('web — null', () => {
    expect(rateUrlFor('web')).toBeNull();
  });

  it('веб-запасной адрес ведёт на страницу Google Play', () => {
    expect(RATE_WEB_URL).toBe('https://play.google.com/store/apps/details?id=app.arcanum.tarot');
  });
});

describe('идентификаторы магазинов', () => {
  it('ANDROID_PACKAGE равен android.package из app.json', () => {
    expect(ANDROID_PACKAGE).toBe(readJson('app.json').expo.android.package);
  });

  it('IOS_APP_ID равен ascAppId из eas.json', () => {
    expect(IOS_APP_ID).toBe(readJson('eas.json').submit.production.ios.ascAppId);
  });
});
