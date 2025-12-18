import { MapSchema } from '@colyseus/schema';
import { memo } from 'react';
import { Player } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { useRenderCount } from './useRenderCount';
import { PlayerDisplay } from './PlayerDisplay';
import './PlayersDisplay.css'

type Props = {
  players: Normalized<MapSchema<Player>>;
}

export const PlayersDisplay = memo(({ players }: Props) => {
  const renderCount = useRenderCount();

  return (
    <div className="players">
      {Object.values(players).map(player => (
        player !== undefined && (
        <PlayerDisplay key={player.name} player={player} />
        )
      ))}
      <div className="players-render-count">Renders: {renderCount}</div>
    </div>
  );
});
