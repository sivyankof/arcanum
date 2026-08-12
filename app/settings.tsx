/** Экран «Настройки» (product-spec §5): всё утилитарное уехало сюда из профиля, чтобы профиль
 *  остался «путём» — уровень, статистика, дневник. Вход — шестерёнка в правом верхнем углу профиля.
 *  Порядок строк по спеке: Тема · Язык (напоминания, рефлексия, имя, экспорт и «о приложении»
 *  добавят задачи 06, 09, 11, 12). */
import { Stack } from 'expo-router';
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
import { planInputFromStore, planPushes } from '../src/lib/pushPlan';
import {
  getPermission,
  listScheduled,
  requestPermission,
  sendTestPush,
  type PermissionState,
} from '../src/lib/pushes';
import { timeLabel } from '../src/lib/settings';
import { useAppActive } from '../src/lib/useAppActive';
import { useApp } from '../src/store/useApp';
import { spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

export default function SettingsScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  const themeMode = useApp((s) => s.themeMode);
  const setThemeMode = useApp((s) => s.setThemeMode);
  const setLang = useApp((s) => s.setLang);
  const resetToday = useApp((s) => s.resetToday);
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const setReflectionOn = useApp((s) => s.setReflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const setDevReflect = useApp((s) => s.setDevReflect);
  const pushesOn = useApp((s) => s.settings.pushesOn);
  const pushMorning = useApp((s) => s.settings.pushMorning);
  const pushEvening = useApp((s) => s.settings.pushEvening);
  const setPushesOn = useApp((s) => s.setPushesOn);
  const setPushTime = useApp((s) => s.setPushTime);
  // весь settings/streak/history — только для DEV-строки «План пушей» (planInputFromStore
  // хочет их целиком, а не по отдельному полю, как остальной экран)
  const settings = useApp((s) => s.settings);
  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);

  // какой пикер открыт (null — ни один)
  const [picker, setPicker] = React.useState<'morning' | 'evening' | null>(null);

  const [planText, setPlanText] = React.useState<string | null>(null);

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
    const plan = planPushes(planInputFromStore(settings, streak, history, now), now);
    const lines = plan.map(
      (p) => `${p.date} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} · ${p.kind}`,
    );
    // в браузере listScheduled — no-op (src/lib/pushes.ts), очередь ОС там всегда пуста;
    // строки плана при этом всё равно печатаются — это ожидаемое поведение веба, не баг
    const queued = (await listScheduled()).length;
    const planLines = lines.length ? lines.join('\n') : tr('settings.planEmpty');
    setPlanText(`${tr('settings.queuedCount', { count: queued })}\n\n${planLines}`);
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
            value={tr('settings.languageValue')}
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
                    console.warn('[push-debug] sendTestPush упал:', err),
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
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 17, marginTop: spacing.s, paddingHorizontal: spacing.xs },
});
