import { memo } from 'react';
import { Position } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { useRenderCount } from './useRenderCount';
import './PositionDisplay.css'

type Props = {
  position: Normalized<Position>; // You'd normally pass in the fields rather than the position class itself, but doing it this way lets the component only re-render when the item changes.
}

export const PositionDisplay = memo(({ position }: Props) => {
  const renderCount = useRenderCount();

  return (
    <div className="position">
      <div className="position-value">{position.x}, {position.y}</div>
      <div className="position-render-count">Renders: {renderCount}</div>
    </div>
  );
});