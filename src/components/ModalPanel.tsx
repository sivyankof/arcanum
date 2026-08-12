/** Модальная подложка: затемнение на весь экран + центрированная панель.
 *
 *  Геометрия у всех модалок приложения одна (подтверждение, выбор времени, дальше — расклады),
 *  поэтому живёт одним компонентом. Тап по затемнению закрывает: случайный промах мимо панели
 *  не должен ничего терять.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';

export function ModalPanel({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose}>
        <Pressable
          style={[st.panel, { backgroundColor: t.bg, borderColor: t.line }]}
          onPress={() => {}}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
});
