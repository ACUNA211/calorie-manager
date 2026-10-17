import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isOnline, useOnline } from './online.js';

describe('isOnline', () => {
  it('is true when the browser reports a connection', () => {
    expect(isOnline({ onLine: true })).toBe(true);
  });

  it('is false only when the browser reports no connection', () => {
    expect(isOnline({ onLine: false })).toBe(false);
  });

  it('assumes online when the browser does not say', () => {
    expect(isOnline({})).toBe(true);
    expect(isOnline(undefined)).toBe(true);
  });
});

describe('useOnline', () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  function setNavigatorOnline(value) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  }

  afterEach(() => {
    cleanup();
    if (original) Object.defineProperty(window.navigator, 'onLine', original);
    else delete window.navigator.onLine;
  });

  it('starts from what the browser reports', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it('follows the window online and offline events', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('stops listening when unmounted', () => {
    setNavigatorOnline(true);
    const { result, unmount } = renderHook(() => useOnline());
    unmount();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);
  });
});
