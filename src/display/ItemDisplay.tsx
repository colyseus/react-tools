import { Item } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { useRenderCount } from './useRenderCount';
import './ItemDisplay.css'

type Props = {
  item: Normalized<Item>; // You'd normally pass in the fields rather than the item class itself, but doing it this way lets the component only re-render when the item changes.
}

export function ItemDisplay({ item }: Props) {
  const renderCount = useRenderCount();

  return (
    <div className="item">
      <div className="item-type">{item.type}</div>
      <div className="item-quantity">x{item.quantity}</div>
      <div className="item-render-count">Renders: {renderCount}</div>
    </div>
  );
}
