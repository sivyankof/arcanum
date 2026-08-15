/** Веб-версия выбора времени: список целых часов.
 *
 *  У @react-native-community/datetimepicker веб-реализации нет вовсе, а без неё экран
 *  «Настройки» нечем прокликать в браузере — то есть шаг 6а процесса по этой задаче
 *  выполнить было бы невозможно. Минуты в вебе не выбираются: там проверяется поведение
 *  экрана, а точное время — на устройстве.
 *
 *  Тап по уже выбранному (подсвеченному) часу — «закрыть без изменений», а не команда стереть
 *  минуты (OptionPicker не зовёт onPick для текущего значения): хранимое значение может нести
 *  реальные минуты — на телефоне их выбирает системный пикер, веб их только показывает.
 */
import React from 'react';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { OptionPicker } from './OptionPicker';

export function TimePicker({
  visible,
  value,
  title,
  hours = [7, 8, 9, 10, 11],
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  title: string;
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const current = String(parseHHMM(value, hours[0]).hour);
  return (
    <OptionPicker
      visible={visible}
      title={title}
      options={hours.map((h) => ({ key: String(h), label: `${h}:00` }))}
      value={current}
      onPick={(key) => onPick(formatHHMM(Number(key), 0))}
      onClose={onClose}
    />
  );
}
