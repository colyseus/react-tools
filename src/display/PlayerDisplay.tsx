import { memo } from 'react';
import { Player } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { ItemsDisplay } from './ItemsDisplay';
import { PositionDisplay } from './PositionDisplay';
import { useRenderHighlight } from './useRenderHighlight';
import './PlayerDisplay.css'

type Props = {
  player: Normalized<Player>; // You'd normally pass in the fields rather than the player class itself, but doing it this way lets the component only re-render when the item changes.
}

export const PlayerDisplay = memo(({ player }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="player" ref={highlightRef}>
      <div className="player-name">{player.name}</div>
      <PositionDisplay position={player.position} />
      <ItemsDisplay items={player.inventory} />
    </div>
  );
});
