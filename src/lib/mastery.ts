/**
 * Ступень мастерства изученной карты по SRS-записи (спека 49, master-plan п. 13).
 * Чистый модуль без импортов react/expo — как srs.ts, из которого берёт тип.
 *
 * Пороги — решение Артёма 20.08: НОВАЯ (записи нет — изучена уроком, не повторялась) ·
 * ЗНАКОМАЯ (intervalDays 0–5) · УВЕРЕННАЯ (6–20) · МАСТЕР (21+).
 * Ноль в пороге ЗНАКОМОЙ — осознанно: «не помню» сбрасывает интервал в 0, и ступень
 * честно ПАДАЕТ (МАСТЕР → провал → ЗНАКОМАЯ), но не до НОВОЙ — запись существует.
 * Изученность проверяет ВЫЗЫВАЮЩИЙ (learnedCardIds): у неизученной карты ступени нет
 * по определению, и тащить курс в чистый модуль ради этой проверки — лишняя связность.
 */
import type { SrsState } from './srs';

export type MasteryLevel = 1 | 2 | 3 | 4;

/** i18n-ключи ярлыков по ступени — одно место, обоим потребителям (чип, DEV). */
export const MASTERY_KEYS: Record<MasteryLevel, string> = {
  1: 'mastery.new',
  2: 'mastery.familiar',
  3: 'mastery.confident',
  4: 'mastery.master',
};

export function masteryLevel(s: SrsState | undefined): MasteryLevel {
  if (!s) return 1;
  if (s.intervalDays <= 5) return 2;
  if (s.intervalDays <= 20) return 3;
  return 4;
}
