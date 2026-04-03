import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDebounce } from '../src/shared/lib/use-debounce';

describe('useDebounce', () => {
  it('delays propagating the latest value until the timeout expires', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: {
        value: 'first',
        delay: 500
      }
    });

    expect(result.current).toBe('first');

    rerender({ value: 'second', delay: 500 });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('second');

    vi.useRealTimers();
  });
});
