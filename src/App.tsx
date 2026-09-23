import { useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SetupScreen } from './screens/SetupScreen';
import type { GameState } from './game/types';
import type { PersistedControl, Snapshot } from './persistence/storage';

type Mode =
  | { screen: 'home' }
  | { screen: 'setup'; demo: boolean }
  | { screen: 'game'; state: GameState; control?: PersistedControl; key: string };

export function App() {
  const [mode, setMode] = useState<Mode>({ screen: 'home' });

  const openGame = (snapshot: Snapshot) =>
    setMode({
      screen: 'game',
      state: snapshot.state,
      control: snapshot.control,
      key: `${snapshot.state.gameId}-${snapshot.savedAt}`,
    });

  switch (mode.screen) {
    case 'home':
      return (
        <HomeScreen
          onNewGame={() => setMode({ screen: 'setup', demo: false })}
          onDemo={() => setMode({ screen: 'setup', demo: true })}
          onContinue={openGame}
          onImport={openGame}
        />
      );
    case 'setup':
      return (
        <SetupScreen
          demo={mode.demo}
          onCancel={() => setMode({ screen: 'home' })}
          onStart={(state) => setMode({ screen: 'game', state, key: state.gameId })}
        />
      );
    case 'game':
      return (
        <GameScreen
          key={mode.key}
          initialState={mode.state}
          initialControl={mode.control}
          onExit={() => setMode({ screen: 'home' })}
        />
      );
  }
}
