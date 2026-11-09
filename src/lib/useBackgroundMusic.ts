/** Подключает фоновую музыку к состоянию приложения (спека 74): играет, пока стор прочитан,
 *  онбординг пройден, музыка включена в настройках и приложение не в фоне. Решение принимает
 *  чистая `shouldPlay`; `inactive` (шторка, переключатель приложений) ничего не меняет. */
import React from 'react';
import { AppState } from 'react-native';
import { useApp } from '../store/useApp';
import { startMusic, stopMusic } from './music';
import { nextInBackground, shouldPlay } from './musicLogic';

export function useBackgroundMusic(hydrated: boolean): void {
  const musicOn = useApp((s) => s.settings.musicOn);
  const onboarded = useApp((s) => s.profile.onboarded);
  const [inBackground, setInBackground] = React.useState(AppState.currentState === 'background');

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setInBackground((prev) => nextInBackground(prev, state));
    });
    return () => sub.remove();
  }, []);

  const play = shouldPlay({ hydrated, onboarded, musicOn, inBackground });
  React.useEffect(() => {
    if (play) startMusic();
    else stopMusic();
    // inBackground в зависимостях: возврат из фона заново подтверждает stopMusic() — иначе плеер,
    // который expo-audio сам возобновил с громкостью 0, остался бы играть без звука
  }, [play, inBackground]);
}
