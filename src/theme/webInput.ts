/** Снимает системную обводку фокуса у текстового поля в браузере: react-native-web рисует
 *  вокруг сфокусированного `TextInput` `outline`, и рядом с нашей рамкой панели/поля она
 *  читается второй, лишней рамкой. На устройстве такого кольца нет вовсе, поэтому вне веба
 *  стиль пустой.
 *
 *  Приём встречался в трёх местах по отдельности (SpreadFields, app/note/[date], SearchField) —
 *  та самая копия 2+ раз, которую правило проекта требует выносить наверх.
 *
 *  Тип `object`, а не `TextStyle`: `outlineStyle` — свойство react-native-web, в типах
 *  react-native его нет (как и `dropShadow`-фильтры в glow.ts).
 */
import { Platform } from 'react-native';

export const noOutline: object | null = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;
