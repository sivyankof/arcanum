/** Нажимаемый текст-ссылка на внешнюю web-страницу (спека 54): открывает `href` через
 *  `expo-web-browser` — на iOS это внутренний SFSafariViewController (пользователь остаётся
 *  в приложении, «Готово» возвращает назад), на вебе — новая вкладка. Если открыть браузер
 *  не удалось (редкий случай), запасной вариант — `Linking.openURL`.
 *  Потребители: пейвол (`app/paywall.tsx`, «Условия»/«Конфиденциальность») и «О приложении»
 *  (`app/about.tsx`, ссылки на политику/условия/поддержку) — три одинаковых нажимаемых
 *  строки, вынесенные сюда по правилу DRY, чтобы не плодить копии открытия URL. */
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Linking, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

interface LinkTxtProps {
  href: string;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function LinkTxt({ href, children, style }: LinkTxtProps) {
  const t = useTheme();

  const open = () => {
    WebBrowser.openBrowserAsync(href).catch(() => Linking.openURL(href));
  };

  return (
    <Txt style={[{ color: t.accent }, style]} accessibilityRole="link" onPress={open}>
      {children}
    </Txt>
  );
}
