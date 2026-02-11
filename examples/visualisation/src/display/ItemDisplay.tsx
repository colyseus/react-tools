import { memo } from 'react';
import { Item } from '../schema/MyRoomState';
import { Snapshot } from '../../../../src';
import { useRenderHighlight } from './useRenderHighlight';
import './ItemDisplay.css'

type Props = {
  item: Snapshot<Item>; // You'd normally pass in the fields rather than the item class itself, but doing it this way lets the component only re-render when the item changes.
}

export const ItemDisplay = memo(({ item }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="item" ref={highlightRef}>
      <div className="item-type">{item.type}</div>
      <div className="item-quantity">x{item.quantity}</div>
    </div>
  );
});
