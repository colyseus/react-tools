import { useRef } from 'react';

export function useRenderCount() {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  return renderCountRef.current;
}
