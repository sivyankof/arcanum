/** Экран «Настройки» (product-spec §5): всё утилитарное уехало сюда из профиля, чтобы профиль
 *  остался «путём» — уровень, статистика, дневник. Вход — шестерёнка в правом верхнем углу профиля.
 *  Порядок строк по спеке: Тема · Язык · напоминания · рефлексия · экспорт/импорт (уже здесь,
 *  задача 11); имя и «о приложении» остаются на очереди — задачи 12 и 13. */
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { SettingsRow } from '../src/components/SettingsRow';
import { TimePicker } from '../src/components/TimePicker';
import { Txt } from '../src/components/Txt';
import {
  backupFileName,
  backupSummary,
  buildBackup,
  parseBackup,
  SCHEMA_VERSION,
  type BackupState,
  type ParseError,
} from '../src/lib/backup';
import { pickBackupText, shareBackup } from '../src/lib/backupIo';
import { course } from '../src/lib/content';
import { nextLessonId } from '../src/lib/courseProgress';
import { formatFullDate, localDateISO } from '../src/lib/dates';
import { buildMailto, SUPPORT_EMAIL } from '../src/lib/feedback';
import { useLang } from '../src/lib/i18n';
import { LANG_NAMES } from '../src/lib/lang';
import { planInputFromStore, planPushes } from '../src/lib/pushPlan';
import {
  getPermission,
  listScheduled,
  requestPermission,
  sendTestPush,
  type PermissionState,
} from '../src/lib/pushes';
import { appVersion } from '../src/lib/appInfo';
import { timeLabel } from '../src/lib/settings';
import { useAppActive } from '../src/lib/useAppActive';
import { useApp } from '../src/store/useApp';
import { spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

// код ошибки parseBackup → ключ текста; тексты в i18n, коды в чистом модуле (приём pushPlan)
const ERR_TEXT: Record<ParseError, string> = {
  notBackup: 'settings.importErrNotBackup',
  newerVersion: 'settings.importErrNewer',
  corrupt: 'settings.importErrCorrupt',
};

export default function SettingsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();

  const themeMode = useApp((s) => s.themeMode);
  const setThemeMode = useApp((s) => s.setThemeMode);
  const setLang = useApp((s) => s.setLang);
  const resetToday = useApp((s) => s.resetToday);
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const setReflectionOn = useApp((s) => s.setReflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const setDevReflect = useApp((s) => s.setDevReflect);
  const devSkipYesterday = useApp((s) => s.devSkipYesterday);
  const pushesOn = useApp((s) => s.settings.pushesOn);
  const pushMorning = useApp((s) => s.settings.pushMorning);
  const pushEvening = useApp((s) => s.settings.pushEvening);
  const setPushesOn = useApp((s) => s.setPushesOn);
  const setPushTime = useApp((s) => s.setPushTime);
  // весь settings/streak/freezes/lastDrawDate — только для DEV-строки «План пушей»
  // (planInputFromStore хочет их целиком, а не по отдельному полю, как остальной экран);
  // history читает ещё и обратная связь — в письмо уходит только его ДЛИНА, не содержимое
  const settings = useApp((s) => s.settings);
  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);
  const freezes = useApp((s) => s.freezes);
  const lastDrawDate = useApp((s) => s.lastDrawDate);
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const setLessonDone = useApp((s) => s.setLessonDone);
  const resetCourse = useApp((s) => s.resetCourse);
  const resetOnboarding = useApp((s) => s.resetOnboarding);

  // какой пикер открыт (null — ни один)
  const [picker, setPicker] = React.useState<'morning' | 'evening' | null>(null);

  const [planText, setPlanText] = React.useState<string | null>(null);

  const restoreBackup = useApp((s) => s.restoreBackup);
  // импорт: сначала подтверждение со сводкой файла, после — уведомление об исходе.
  // В notice лежат КЛЮЧИ i18n, а не готовый текст: язык может смениться самим импортом,
  // и уведомление обязано выйти уже на языке из бэкапа
  const [importAsk, setImportAsk] = React.useState<
    { state: BackupState; entries: number; streak: number; dateISO: string } | null
  >(null);
  const [notice, setNotice] = React.useState<{ titleKey: string; textKey: string } | null>(null);
  // fallback обратной связи: почтового клиента нет — показываем адрес с кнопкой копирования
  const [mailHelp, setMailHelp] = React.useState(false);

  // читаемая расшифровка плана: две независимые вещи, путать нельзя.
  // 1) Строки «дата · время · вид» — то, что НАСЧИТАЛ planPushes с теми же входными данными,
  //    что берёт живой планировщик (planInputFromStore — общая сборка с usePushScheduler.ts):
  //    цифры точные, это ровно те числа, из которых строится системное расписание.
  // 2) Число в счётчике — сколько уведомлений РЕАЛЬНО лежит в очереди ОС (listScheduled().length).
  //    Даты из ответа ОС достать нельзя, хотя тайпинги expo-notifications обещают обратное:
  //    на Android DATE-триггер возвращается как {type:'date', value: <timestamp>} — поле
  //    называется `value`, а не `date`, которого тайпинги ждут; на iOS DATE-триггер система
  //    вообще хранит как задержку в секундах от момента постановки (тип приходит как
  //    'timeInterval'), и к моменту показа эта задержка уже «утекла» — обратный пересчёт
  //    даты был бы тихо неверным. Поэтому даты берём со своей стороны, а число — с ОС:
  //    расхождение между числом строк плана и счётчиком само по себе сигнал, что
  //    перепланирование не долетело до системы.
  //    ⚠️ Два безобидных случая расхождения, которые НЕ значат «планировщик сломан» (пункт F
  //    финального ревью 06б): (1) сразу после «DEV · тестовый пуш» счётчик на 10 секунд больше
  //    строк плана — тестовый пуш стоит в очереди ОС, но не входит в planPushes; (2) если за эти
  //    же 10 секунд свернуть и развернуть приложение, тестовый пуш пропадает: он поставлен В
  //    ОБХОД сериализованной цепочки applyPlan (см. src/lib/pushes.ts), а возврат из фона зовёт
  //    свой пересчёт, который начинается с cancelAllScheduledNotificationsAsync — отменяет вообще
  //    всё, включая тестовый пуш.
  const showPlan = async () => {
    const now = new Date();
    const plan = planPushes(
      planInputFromStore(settings, streak, history, freezes, lastDrawDate, now),
      now,
    );
    const lines = plan.map(
      (p) => `${p.date} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} · ${p.kind}`,
    );
    // в браузере listScheduled — no-op (src/lib/pushes.ts), очередь ОС там всегда пуста;
    // строки плана при этом всё равно печатаются — это ожидаемое поведение веба, не баг
    const queued = (await listScheduled()).length;
    const planLines = lines.length ? lines.join('\n') : tr('settings.planEmpty');
    setPlanText(`${tr('settings.queuedCount', { count: queued })}\n\n${planLines}`);
  };

  // общий busy-guard от двойного тапа на «Экспорт»/«Импорт» (волна фиксов финального ревью):
  // параллельный второй вызов getDocumentAsync реджектит и рисует ложное «Файл повреждён»,
  // второй shareAsync — ложное «Не удалось подготовить файл», плюс два Modal друг на друге.
  // Образец защиты от повторного входа — requestingPerm ниже в этом же файле.
  const busy = React.useRef(false);

  const onExport = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const file = buildBackup(useApp.getState(), SCHEMA_VERSION, new Date().toISOString());
      await shareBackup(JSON.stringify(file, null, 2), backupFileName(localDateISO()));
    } catch (err) {
      // сбой записи или шаринга не должен молчать: иначе «поделился или нет» неотличимо
      console.warn('[backup] экспорт не удался:', err);
      setNotice({ titleKey: 'settings.errTitle', textKey: 'settings.exportErr' });
    } finally {
      busy.current = false;
    }
  };

  const onImport = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const text = await pickBackupText();
      if (text === null) return; // передумал в системном пикере — это не ошибка, молчим
      const parsed = parseBackup(text, SCHEMA_VERSION);
      if (!parsed.ok) {
        setNotice({ titleKey: 'settings.errTitle', textKey: ERR_TEXT[parsed.error] });
        return;
      }
      setImportAsk({ state: parsed.state, ...backupSummary(parsed) });
    } catch (err) {
      // не прочитался сам файл (права, обрыв) — по смыслу для человека то же «повреждён»
      console.warn('[backup] импорт не удался:', err);
      setNotice({ titleKey: 'settings.errTitle', textKey: ERR_TEXT.corrupt });
    } finally {
      busy.current = false;
    }
  };

  // обратная связь (спека 13): mailto без бэкенда. Диагностика — только безличные пять полей
  // (версия, платформа+ОС, язык, тема, ЧИСЛО записей истории), ни заметок, ни имени, ни даты
  // рождения. ⚠️ Linking.canOpenURL не используем: на iOS для mailto он требует
  // LSApplicationQueriesSchemes в Info.plist и в Expo Go врёт — ловим reject самого openURL
  const onFeedback = () => {
    const body = tr('feedback.body', {
      version: appVersion(),
      // на вебе Platform.Version — бессмысленное «0.0.0», одного имени платформы достаточно
      os: Platform.OS === 'web' ? 'web' : `${Platform.OS} ${Platform.Version}`,
      lang,
      theme: themeMode === 'dark' ? tr('settings.dark') : tr('settings.light'),
      history: history.length,
    });
    Linking.openURL(buildMailto(SUPPORT_EMAIL, tr('feedback.subject'), body)).catch(() =>
      setMailHelp(true),
    );
  };

  // системное разрешение спрашиваем при входе на экран и при возврате из фона:
  // человек мог уйти в системные настройки и вернуться уже с другим ответом
  const [perm, setPerm] = React.useState<PermissionState>('undetermined');
  React.useEffect(() => {
    getPermission().then(setPerm);
  }, []);
  useAppActive(() => {
    getPermission().then(setPerm);
  });

  const denied = perm === 'denied';
  // между тапом «включить» и ответом системного диалога стор ещё не тронут (см. onPress ниже) —
  // без отдельного состояния строка либо молчала бы про ожидание, либо (что хуже) показывала
  // «Вкл» до того, как разрешение реально получено
  const [requestingPerm, setRequestingPerm] = React.useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* подпись кнопки «назад» задаём явно: у таб-навигатора нет заголовка, из которого
          система взяла бы её сама, и вместо «Профиль» получилось бы «Back» */}
      <Stack.Screen options={{ title: tr('settings.title'), headerBackTitle: tr('card.backProfile') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        <FadeUp index={0}>
          <SettingsRow
            icon={themeMode === 'dark' ? 'moon' : 'sunny'}
            label={tr('settings.theme')}
            value={themeMode === 'dark' ? tr('settings.dark') : tr('settings.light')}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
        </FadeUp>
        <FadeUp index={1}>
          <SettingsRow
            icon="language"
            label={tr('settings.language')}
            value={LANG_NAMES[lang]}
            onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          />
        </FadeUp>
        <FadeUp index={2}>
          <SettingsRow
            icon="moon-outline"
            label={tr('settings.reflection')}
            value={reflectionOn ? tr('settings.on') : tr('settings.off')}
            onPress={() => setReflectionOn(!reflectionOn)}
          />
        </FadeUp>
        <FadeUp index={3}>
          <SettingsRow
            icon="notifications-outline"
            label={tr('settings.pushes')}
            value={
              denied
                ? tr('settings.pushDenied')
                : requestingPerm
                  ? tr('settings.pushRequesting')
                  : pushesOn
                    ? tr('settings.on')
                    : tr('settings.off')
            }
            onPress={() => {
              // повторный тап, пока ждём ответ системы, ничего нового не запускает — иначе
              // можно было бы всплыть двумя системными диалогами разрешения подряд
              if (requestingPerm) return;
              // getPermission() на вебе никогда не отдаёт 'denied' (см. src/lib/pushes.ts),
              // так что на практике сюда не попасть — но react-native-web не реализует
              // Linking.openSettings вовсе, и звать несуществующий метод «на всякий случай»
              // нельзя: защита от падения экрана, если это условие когда-нибудь изменится
              if (denied) {
                if (Platform.OS !== 'web') Linking.openSettings();
                return;
              }
              const next = !pushesOn;
              // выключение — всегда сразу и без вопросов, спрашивать тут нечего
              if (!next) {
                setPushesOn(false);
                return;
              }
              // Отказ в прелюдии («Не сейчас») больше не спрашивает сам — системный диалог даётся
              // один раз навсегда, и это осознанное решение (product-spec §1). Второй и последний
              // шанс спросить — явное включение тумблера здесь (найдено финальным ревью 06б, пункт B).
              // ⚠️ Разрешение спрашиваем ДО записи в стор, а не после: смена `settings.pushesOn` —
              // это и есть сигнал планировщику пересчитать план (usePushScheduler.ts слушает
              // `settings` целиком), и сигнал обязан прийти УЖЕ с известным ответом ОС. Раньше стор
              // менялся первым, эффект планировщика срабатывал на 'undetermined', гасил всё
              // и ничего не ставил, а результат запроса прилетал только в локальный `setPerm`,
              // который планировщик не слушает вовсе, — второй пересчёт не запускало ничто.
              // Тот самый баг, который уже чинили в прелюдии («Разрешить» на «Сегодня»), предыдущая
              // правка вернула именно сюда — второй волной фиксов 06б исправлено тем же приёмом.
              if (perm === 'undetermined' && Platform.OS !== 'web') {
                setRequestingPerm(true);
                requestPermission()
                  .then((status) => {
                    setPerm(status);
                    setPushesOn(true);
                  })
                  .catch((err) => {
                    // сбой запроса (отклонённый промис) не должен ронять экран и не должен тихо
                    // оставлять тумблер «включённым» без подтверждения системы — стор не трогаем,
                    // строка вернётся к «Выкл», это и есть честное состояние
                    console.warn('[settings] не удалось запросить разрешение на пуши:', err);
                  })
                  .finally(() => setRequestingPerm(false));
                return;
              }
              // разрешение уже решено (granted) или веб — спрашивать нечего, пишем сразу
              setPushesOn(true);
            }}
          />
        </FadeUp>
        {pushesOn && !denied && (
          <>
            <FadeUp index={4}>
              <SettingsRow
                icon="sunny-outline"
                label={tr('settings.pushMorning')}
                value={timeLabel(pushMorning)}
                onPress={() => setPicker('morning')}
              />
            </FadeUp>
            <FadeUp index={5}>
              <SettingsRow
                icon="moon-outline"
                label={tr('settings.pushEvening')}
                value={timeLabel(pushEvening)}
                onPress={() => setPicker('evening')}
              />
            </FadeUp>
            {/* единственное место, где можно рассказать про два молчаливых пуша:
                своих тумблеров у спасения серии и возврата нет (спека 06б, решение 4) */}
            <FadeUp index={5}>
              <Txt style={[st.hint, { color: t.muted }]}>{tr('settings.pushHint')}</Txt>
            </FadeUp>
          </>
        )}
        <FadeUp index={6}>
          <SettingsRow icon="share-outline" label={tr('settings.exportData')} value="" onPress={onExport} />
        </FadeUp>
        <FadeUp index={6}>
          <SettingsRow icon="folder-open-outline" label={tr('settings.importData')} value="" onPress={onImport} />
        </FadeUp>
        <FadeUp index={7}>
          <SettingsRow
            icon="mail-outline"
            label={tr('settings.feedback')}
            value={tr('settings.feedbackValue')}
            onPress={onFeedback}
          />
        </FadeUp>
        {/* «О приложении» (спека 12): версия — та же appVersion(), что читает и сам экран,
            чтобы значение в строке и на экране никогда не разошлось */}
        <FadeUp index={7}>
          <SettingsRow
            icon="information-circle-outline"
            label={tr('settings.about')}
            value={`v${appVersion()}`}
            onPress={() => router.push('/about')}
          />
        </FadeUp>
        {__DEV__ && (
          <>
            <FadeUp index={6}>
              <SettingsRow
                icon="refresh"
                label={tr('settings.resetToday')}
                value="DEV"
                onPress={resetToday}
              />
            </FadeUp>
            <FadeUp index={7}>
              <SettingsRow
                icon="snow-outline"
                label={tr('settings.devSkipYesterday')}
                value="DEV"
                // симуляция пропуска: следующий переворот карты тратит заморозку или,
                // если запас нулевой, сбрасывает серию (спека 10) — иначе механику
                // не проверить ни в вебе, ни на лайв-проверке, не ожидая сутки
                onPress={devSkipYesterday}
              />
            </FadeUp>
            <FadeUp index={7}>
              <SettingsRow
                icon="time-outline"
                label={tr('settings.reflectNow')}
                value={devReflect ? 'DEV · ВКЛ' : 'DEV'}
                onPress={() => setDevReflect(!devReflect)}
              />
            </FadeUp>
            <FadeUp index={8}>
              <SettingsRow
                icon="send-outline"
                label={tr('settings.testPush')}
                value="DEV"
                // без catch сбой постановки уходил бы в необработанный reject: строка молчит,
                // и «пуш не пришёл» невозможно отличить от «пуш не поставился»
                onPress={() =>
                  sendTestPush(lang).catch((err) =>
                    console.warn('[pushes] тестовый пуш не поставился:', err),
                  )
                }
              />
            </FadeUp>
            <FadeUp index={9}>
              <SettingsRow
                icon="list-outline"
                label={tr('settings.showPlan')}
                value="DEV"
                onPress={showPlan}
              />
            </FadeUp>
            <FadeUp index={10}>
              <SettingsRow
                icon="school-outline"
                label={tr('settings.devLessonDone')}
                value="DEV"
                // проверка состояний пути до движка урока (08): двигает current по курсу
                onPress={() => {
                  const next = nextLessonId(course, lessonsProgress);
                  if (next) setLessonDone(next, true);
                }}
              />
            </FadeUp>
            <FadeUp index={11}>
              <SettingsRow
                icon="arrow-undo-outline"
                label={tr('settings.devCourseReset')}
                value="DEV"
                onPress={resetCourse}
              />
            </FadeUp>
            <FadeUp index={12}>
              <SettingsRow
                icon="sparkles-outline"
                label={tr('settings.devOnboarding')}
                value="DEV"
                // сброс профиля целиком: гард в _layout сам уводит на онбординг
                onPress={resetOnboarding}
              />
            </FadeUp>
          </>
        )}
        <TimePicker
          visible={picker !== null}
          value={picker === 'evening' ? pushEvening : pushMorning}
          title={picker === 'evening' ? tr('settings.pickEvening') : tr('settings.pickMorning')}
          hours={picker === 'evening' ? [19, 20, 21, 22, 23] : [7, 8, 9, 10, 11]}
          onPick={(hhmm) => picker && setPushTime(picker, hhmm)}
          onClose={() => setPicker(null)}
        />
        <ConfirmDialog
          visible={planText !== null}
          title={tr('settings.showPlan')}
          message={planText ?? ''}
          confirmLabel={tr('settings.ok')}
          cancelLabel={tr('settings.close')}
          confirmTone="accent"
          onConfirm={() => setPlanText(null)}
          onCancel={() => setPlanText(null)}
        />
        <ConfirmDialog
          visible={importAsk !== null}
          title={tr('settings.importConfirmTitle')}
          message={
            importAsk
              ? tr('settings.importConfirmText', {
                  date: formatFullDate(importAsk.dateISO, lang),
                  entries: importAsk.entries,
                  streak: importAsk.streak,
                })
              : ''
          }
          confirmLabel={tr('settings.importConfirm')}
          cancelLabel={tr('settings.importCancel')}
          onConfirm={async () => {
            if (importAsk) {
              // Новое устройство — новое разрешение (тот же класс бага, что уже чинили в 06б):
              // бэкап несёт settings.pushAsked/pushesOn СО СТАРОГО телефона, а системное
              // разрешение ОС новому телефону не передалось и на нём 'undetermined' — без
              // сброса флага прелюдия больше никогда не спросит, тумблер будет врать «Вкл»,
              // а план пушей не доедет до ОС. В вебе getPermission() тоже всегда отдаёт
              // 'undetermined' (см. src/lib/pushes.ts) — сброс срабатывает и там, осознанно.
              const permNow = await getPermission();
              const state =
                permNow === 'granted'
                  ? importAsk.state
                  : { ...importAsk.state, settings: { ...importAsk.state.settings, pushAsked: false } };
              restoreBackup(state);
            }
            setImportAsk(null);
            setNotice({ titleKey: 'settings.importDoneTitle', textKey: 'settings.importDoneText' });
          }}
          onCancel={() => setImportAsk(null)}
        />
        <ConfirmDialog
          visible={mailHelp}
          title={tr('feedback.noMailTitle')}
          message={tr('feedback.noMailText', { email: SUPPORT_EMAIL })}
          confirmLabel={tr('feedback.copy')}
          cancelLabel={tr('settings.close')}
          confirmTone="accent"
          onConfirm={() => {
            // сбой копирования не должен молчать и не должен ронять экран (образец — onExport)
            Clipboard.setStringAsync(SUPPORT_EMAIL)
              .then(() => setNotice({ titleKey: 'feedback.copiedTitle', textKey: 'feedback.copiedText' }))
              .catch((err) => console.warn('[feedback] не удалось скопировать адрес:', err));
            setMailHelp(false);
          }}
          onCancel={() => setMailHelp(false)}
        />
        <ConfirmDialog
          visible={notice !== null}
          title={notice ? tr(notice.titleKey) : ''}
          message={notice ? tr(notice.textKey) : ''}
          confirmLabel={tr('settings.ok')}
          confirmTone="accent"
          onConfirm={() => setNotice(null)}
        />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 17, marginTop: spacing.s, paddingHorizontal: spacing.xs },
});
