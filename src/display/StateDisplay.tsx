import { memo } from 'react';
import { MyRoomState } from '../schema/MyRoomState';
import { Snapshot } from '../schema/useRoomState';
import { useRenderHighlight } from './useRenderHighlight';
import { PlayersDisplay } from './PlayersDisplay';
import './StateDisplay.css'

type Props = {
  state: Snapshot<MyRoomState>;
}

export const StateDisplay = memo(({ state }: Props) => {
  const highlightRef = useRenderHighlight<HTMLDivElement>();

  return (
    <div className="state" ref={highlightRef}>
      <h1>State</h1>
      <p><strong>myString:</strong> {state.myString}</p>
      <PlayersDisplay players={state.players} />
    </div>
  );
});