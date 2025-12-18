import { Player } from '../schema/MyRoomState';
import { useRenderCount } from './useRenderCount';
import { PlayerDisplay } from './PlayerDisplay';
import './PlayersDisplay.css'
import { Normalized } from '../schema/useRoomState';

type Props = {
  players: Readonly<Record<string, Normalized<Player>>>;
}

export function PlayersDisplay({ players }: Props) {
  const renderCount = useRenderCount();

  return (
    <div className="players">
      {Object.values(players).map(player => (
        <PlayerDisplay key={player.name} player={player} />
      ))}
      <div className="players-render-count">Renders: {renderCount}</div>
    </div>
  );
}
