import { memo } from 'react';
import { ArraySchema } from '@colyseus/schema';
import { Item } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { ItemDisplay } from './ItemDisplay';
import { useRenderHighlight } from './useRenderHighlight';
import './ItemDisplay.css'

type Props = {
  items: Normalized<ArraySchema<Item>>;
}

export const ItemsDisplay = memo(({ items }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="items" ref={highlightRef}>
      {items.map(item => (
        <ItemDisplay key={item.type} item={item} />
      ))}
    </div>
  );
});
