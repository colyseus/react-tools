import { memo } from 'react';
import { ArraySchema } from '@colyseus/schema';
import { Snapshot } from '../../../../src';
import { Item } from '../schema/MyRoomState';
import { ItemDisplay } from './ItemDisplay';
import { useRenderHighlight } from './useRenderHighlight';
import './ItemsDisplay.css'

type Props = {
  items: Snapshot<ArraySchema<Item>>;
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
