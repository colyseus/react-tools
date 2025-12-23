import { MapSchema } from '@colyseus/schema';
import { memo } from 'react';
import { Player } from '../schema/MyRoomState';
import { Snapshot } from '../schema/useRoomState';
import { useRenderHighlight } from './useRenderHighlight';
import { PlayerDisplay } from './PlayerDisplay';
import './PlayersDisplay.css'

type Props = {
  players: Snapshot<MapSchema<Player>>;
}

export const PlayersDisplay = memo(({ players }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="players" ref={highlightRef}>
      <h2>Players</h2>

      {Object.entries(players).map(([id, player]) => (
        player !== undefined && (
          <PlayerDisplay key={id} player={player} />
        )
      ))}
    </div>
  );
});
