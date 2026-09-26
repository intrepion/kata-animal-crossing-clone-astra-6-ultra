import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DialogueBox from './DialogueBox';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const greeting = 'Hello, honeybun! Could you bring three peaches for the tart I’m baking?';
const press = (key: string, repeat = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key, code: key === ' ' ? 'Space' : key === 'e' ? 'KeyE' : key, repeat });

describe('DialogueBox keyboard conversation', () => {
  it('reveals the message on E before allowing the selected choice to run', () => {
    const ask = vi.fn();
    const close = vi.fn();
    render(<DialogueBox speaker="Maple" message={greeting} onClose={close} choices={[{ label: 'Need a hand?', action: ask }]} />);

    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Need a hand/ })).toBeNull();
    press('e');
    expect(screen.queryByRole('button', { name: /Continue/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Need a hand/ })).toBeTruthy();
    expect(ask).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    press('e');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('ignores held-key repeats both during typing and after choices appear', () => {
    const deliver = vi.fn();
    render(<DialogueBox speaker="Maple" message={greeting} onClose={vi.fn()} choices={[{ label: 'Here are your peaches!', action: deliver }]} />);

    press('e', true);
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
    press('e');
    press('e', true);
    press(' ', true);
    press('Enter', true);
    expect(deliver).not.toHaveBeenCalled();
    press('e');
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('uses arrow keys to choose a response and E to activate that response', () => {
    const help = vi.fn();
    const goodbye = vi.fn();
    render(<DialogueBox speaker="Pip" message="Hello, skipper!" onClose={vi.fn()} choices={[
      { label: 'I can help.', action: help },
      { label: 'See you tomorrow.', action: goodbye },
    ]} />);

    press('e');
    press('ArrowDown');
    press('e');
    expect(goodbye).toHaveBeenCalledTimes(1);
    expect(help).not.toHaveBeenCalled();
    press('ArrowUp');
    press('e');
    expect(help).toHaveBeenCalledTimes(1);
  });

  it('does not activate a disabled response and closes choice-free speech only after revealing it', () => {
    const unavailable = vi.fn();
    const close = vi.fn();
    const view = render(<DialogueBox speaker="Clover" message={greeting} onClose={close} choices={[
      { label: 'Give a butterfly', action: unavailable, disabled: true },
    ]} />);
    press('e');
    press('e');
    expect(unavailable).not.toHaveBeenCalled();

    view.rerender(<DialogueBox speaker="Clover" message="The garden looks lovely today, petal." onClose={close} />);
    press('e');
    expect(close).not.toHaveBeenCalled();
    press('e');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
