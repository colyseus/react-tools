import { memo } from 'react';
import { MyRoomState } from '../schema/MyRoomState';
import { Normalized } from '../schema/useRoomState';
import { useRenderHighlight } from './useRenderHighlight';
import { PlayersDisplay } from './PlayersDisplay';
import './StateDisplay.css'

type Props = {
  state: Normalized<MyRoomState>;
}

export const StateDisplay = memo(({ state }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="state" ref={highlightRef}>
      <h2>State</h2>
      <p><strong><code>.myString</code>:</strong> {state.myString}</p>
      <hr />
      <PlayersDisplay players={state.players} />
    </div>
  );
});