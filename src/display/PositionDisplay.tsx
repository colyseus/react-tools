import { memo } from 'react';
import { Position } from '../schema/MyRoomState';
import { Snapshot } from '../schema/useRoomState';
import { useRenderHighlight } from './useRenderHighlight';
import './PositionDisplay.css'

type Props = {
  position: Snapshot<Position>; // You'd normally pass in the fields rather than the position class itself, but doing it this way lets the component only re-render when the item changes.
}

export const PositionDisplay = memo(({ position }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="position" ref={highlightRef}>
      {position.x}, {position.y}
    </div>
  );
});