import { useEffect, useRef } from 'react';

/**
 * Returns a ref that, when attached to an element, will briefly highlight it
 * with a CSS class whenever the component re-renders.
 * 
 * This works by directly manipulating the DOM via the ref, so the highlight
 * can be toggled without causing additional React re-renders.
 */
export function useRenderHighlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  // This runs on every render. It will only work as expected within a memoized component.
  // We use a ref to manipulate the DOM directly, avoiding re-render loops.
  if (ref.current) {
    const el = ref.current;
    el.classList.add('render-highlight');
    setTimeout(() => el.classList.remove('render-highlight'), 1500);
  }

  // This runs on the first render only.
  // New elements should be highlighted when they are added.
  useEffect(() => {
    if (ref.current) {
      const el = ref.current;
      el.classList.add('render-highlight');
      setTimeout(() => el.classList.remove('render-highlight'), 1500);
    }
  }, []);

  return ref;
}
