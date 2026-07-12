import { describe, expect, it } from 'vitest';
import {
  compileScript,
  EditEvent,
  humanize,
  parseDirectives,
  Player,
} from '../src/index';

/** Minimal in-memory "editor": inserts at end, backspaces from end. */
function makeBuffer() {
  let text = '';
  const apply = (event: EditEvent) => {
    if (event.kind === 'insert') {
      text += event.text;
    } else {
      text = text.slice(0, text.length - event.count);
    }
  };
  return { apply, get text() { return text; } };
}

const instant = () => Promise.resolve();

describe('parseDirectives', () => {
  it('strips directives and keeps the rest byte-exact', () => {
    const source = 'line1\n//~ pause 800\nline2\n#~ checkpoint intro\nline3\n';
    const segments = parseDirectives(source);
    expect(segments).toEqual([
      { kind: 'text', text: 'line1\n' },
      { kind: 'pause', ms: 800 },
      { kind: 'text', text: 'line2\n' },
      { kind: 'checkpoint', name: 'intro' },
      { kind: 'text', text: 'line3\n' },
    ]);
  });

  it('does not treat regular comments as directives', () => {
    const source = '// a normal comment\n# ~ not glued, not a directive\n';
    expect(parseDirectives(source)).toEqual([{ kind: 'text', text: source }]);
  });
});

describe('humanize', () => {
  it('reproduces the input exactly when typos are disabled', () => {
    const text = 'function add(a, b) {\n  return a + b;\n}\n';
    const steps = humanize(text, { typoRate: 0, seed: 42 });
    const buffer = makeBuffer();
    steps.forEach((s) => buffer.apply(s.event));
    expect(buffer.text).toBe(text);
    expect(steps).toHaveLength([...text].length);
  });

  it('still converges to the input when every letter gets a typo', () => {
    const text = 'const ghost = "typeghost";\n';
    const steps = humanize(text, { typoRate: 1, seed: 7 });
    const buffer = makeBuffer();
    steps.forEach((s) => buffer.apply(s.event));
    expect(buffer.text).toBe(text);
    expect(steps.length).toBeGreaterThan([...text].length);
  });

  it('is deterministic for a given seed', () => {
    const a = humanize('hello world', { seed: 123 });
    const b = humanize('hello world', { seed: 123 });
    expect(a).toEqual(b);
  });
});

describe('compileScript', () => {
  it('produces a clean source without directives', () => {
    const source = '//~ checkpoint\nconsole.log(1);\n//~ pause 500\nconsole.log(2);\n';
    const script = compileScript(source, { typoRate: 0, seed: 1 });
    expect(script.cleanSource).toBe('console.log(1);\nconsole.log(2);\n');
    expect(script.checkpoints).toEqual([{ index: 0, name: undefined }]);
  });
});

describe('Player', () => {
  it('applies the whole script in auto mode', async () => {
    const source = 'const x = 1;\n';
    const script = compileScript(source, { typoRate: 0, seed: 5 });
    const buffer = makeBuffer();
    const player = new Player(script, buffer.apply, { timeScale: 0, sleep: instant });
    await player.play();
    expect(buffer.text).toBe(source);
    expect(player.state).toBe('done');
  });

  it('waits at checkpoints until resumed', async () => {
    const source = 'a\n//~ checkpoint half\nb\n';
    const script = compileScript(source, { typoRate: 0, seed: 5 });
    const buffer = makeBuffer();
    const player = new Player(script, buffer.apply, { timeScale: 0, sleep: instant });

    const playing = player.play();
    await new Promise((r) => setTimeout(r, 20));
    expect(player.state).toBe('waiting-checkpoint');
    expect(buffer.text).toBe('a\n');

    player.resume();
    await playing;
    expect(buffer.text).toBe('a\nb\n');
  });

  it('can be paused and resumed', async () => {
    const source = 'abcdef';
    const script = compileScript(source, { typoRate: 0, seed: 5 });
    const buffer = makeBuffer();
    const player = new Player(script, buffer.apply, { timeScale: 0, sleep: instant });

    player.pause(); // pausing before play() is a no-op
    const playing = player.play();
    player.pause();
    await new Promise((r) => setTimeout(r, 20));
    const frozen = buffer.text;
    await new Promise((r) => setTimeout(r, 20));
    expect(buffer.text).toBe(frozen);

    player.resume();
    await playing;
    expect(buffer.text).toBe(source);
  });

  it('advances manually in hacker mode, finishing typo bursts atomically', async () => {
    const text = 'abc';
    const steps = humanize(text, { typoRate: 1, seed: 9 });
    const buffer = makeBuffer();
    const player = new Player(steps, buffer.apply);

    let alive = true;
    while (alive) {
      alive = await player.advance(1);
      // A typo burst must never leave a dangling wrong character.
      expect(text.startsWith(buffer.text)).toBe(true);
    }
    expect(buffer.text).toBe(text);
    expect(player.state).toBe('done');
  });

  it('catches up when the host throttles timers (hidden-tab survival)', async () => {
    // Simulate Chrome clamping every setTimeout to 1s: the clock jumps 1000ms
    // per sleep, no matter what was requested.
    let clock = 0;
    let sleepCalls = 0;
    const sleep = () => {
      sleepCalls++;
      clock += 1000;
      return Promise.resolve();
    };
    const steps = Array.from({ length: 40 }, (): { event: EditEvent; delayMs: number } => ({
      event: { kind: 'insert', text: 'x' },
      delayMs: 50,
    }));
    const buffer = makeBuffer();
    const player = new Player(steps, buffer.apply, { sleep, now: () => clock });

    await player.play();
    // 40 × 50ms = 2s of virtual typing; with 1s throttled ticks the player
    // must burst-apply overdue steps instead of sleeping 40 times.
    expect(buffer.text).toBe('x'.repeat(40));
    expect(sleepCalls).toBeLessThanOrEqual(4);
  });

  it('serializes overlapping advance calls (rapid keystrokes, async apply)', async () => {
    const text = 'abcdefghijkl';
    const steps = humanize(text, { typoRate: 0, seed: 3 });
    let buffer = '';
    const slowApply = async (event: EditEvent) => {
      await new Promise((r) => setTimeout(r, 1));
      if (event.kind === 'insert') buffer += event.text;
      else buffer = buffer.slice(0, buffer.length - event.count);
    };
    const player = new Player(steps, slowApply);

    // Fire keystrokes without waiting for each other, like a real mash.
    await Promise.all([player.advance(3), player.advance(3), player.advance(3), player.advance(3)]);
    expect(buffer).toBe(text);
  });

  it('reports being exhausted', async () => {
    const steps = humanize('x', { typoRate: 0, seed: 1 });
    const player = new Player(steps, () => undefined);
    expect(await player.advance(10)).toBe(false);
    expect(await player.advance(10)).toBe(false);
  });
});
