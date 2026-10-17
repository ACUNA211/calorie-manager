import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast, { TOAST_MS } from './Toast.jsx';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('lasts five seconds', () => {
    expect(TOAST_MS).toBe(5000);
  });

  it('shows its message with an action that runs when pressed', () => {
    const onAction = vi.fn();
    render(
      <Toast message="Entry deleted." actionLabel="Undo" onAction={onAction} onDismiss={() => {}} />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Entry deleted.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('shows no action when there is nothing to undo', () => {
    render(<Toast message="Could not undo that." onDismiss={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('goes away after the time is up, and not before', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Logged." onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps its countdown when the parent re-renders with a new dismiss function', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Toast message="Logged." onDismiss={first} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<Toast message="Logged." onDismiss={second} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
