import { useRef } from 'react';

/**
 * Indicate how many times the current component has rendered. This only works in a memoized component.
 * (React renders any non-memoized component every time its parent renders, and even if there are no output changes, still commits a (null) render, so useEffect still fires.)
 */
export function useRenderCount() {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  return renderCountRef.current;
}
