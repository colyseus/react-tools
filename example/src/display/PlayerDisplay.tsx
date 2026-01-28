import { memo } from 'react';
import { Player } from '../schema/MyRoomState';
import { Snapshot } from '../../../src';
import { ItemsDisplay } from './ItemsDisplay';
import { PositionDisplay } from './PositionDisplay';
import { useRenderHighlight } from './useRenderHighlight';
import './PlayerDisplay.css'

type Props = {
  player: Snapshot<Player>; // You'd normally pass in the fields rather than the player class itself, but doing it this way lets the component only re-render when the item changes.
}

export const PlayerDisplay = memo(({ player }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="player" ref={highlightRef}>
      <div className="player-field"><strong>Name:</strong><div>{player.name}</div></div>
      <div className="player-field"><strong>Position:</strong><PositionDisplay position={player.position} /></div>
      <div className="player-field"><strong>Inventory:</strong><ItemsDisplay items={player.inventory} /></div>
    </div>
  );
});
