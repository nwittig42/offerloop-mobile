import { useEffect, useState } from 'react';

/**
 * Cycles through `examples`, typing each one out one character at a time,
 * holding it a moment, erasing it, then moving to the next. The same
 * animated-placeholder feel as the Scout composer and the feed filter's
 * example box, pulled out so any input can borrow it. Returns '' when
 * `examples` is empty.
 */
export function useTypewriterHint(examples: string[]): string {
  const [hint, setHint] = useState('');
  useEffect(() => {
    if (!examples.length) {
      setHint('');
      return;
    }
    let hi = 0;
    let ci = 0;
    let phase: 'type' | 'erase' = 'type';
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = examples[hi % examples.length];
      if (phase === 'type') {
        ci += 1;
        setHint(full.slice(0, ci));
        if (ci >= full.length) {
          phase = 'erase';
          t = setTimeout(step, 2100);
        } else {
          t = setTimeout(step, 42);
        }
      } else {
        ci -= 3;
        if (ci <= 0) {
          ci = 0;
          setHint('');
          phase = 'type';
          hi += 1;
          t = setTimeout(step, 500);
        } else {
          setHint(full.slice(0, ci));
          t = setTimeout(step, 22);
        }
      }
    };
    t = setTimeout(step, 600);
    return () => clearTimeout(t);
  }, [examples]);
  return hint;
}
