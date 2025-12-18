import { ArraySchema } from '@colyseus/schema';
import { Item } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { useRenderCount } from './useRenderCount';
import { ItemDisplay } from './ItemDisplay';
import './ItemDisplay.css'

type Props = {
  items: Normalized<ArraySchema<Item>>;
}

export function ItemsDisplay({ items }: Props) {
  const renderCount = useRenderCount();

  return (
    <div className="items">
      {items.map(item => (
        <ItemDisplay key={item.type} item={item} />
      ))}

      <div className="items-render-count">Renders: {renderCount}</div>
    </div>
  );
}
