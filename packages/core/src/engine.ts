import { CompiledScript, EditEvent, Step } from './types';

export type ApplyFn = (event: EditEvent) => void | Promise<void>;

export type PlayerState =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'waiting-checkpoint'
  | 'done'
  | 'stopped';

export interface PlayerOptions {
  /** Multiplier applied to every delay. 0.5 = twice as fast, 0 = instant. */
  timeScale?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock, for tests. */
  now?: () => number;
  onStateChange?: (state: PlayerState) => void;
  onProgress?: (applied: number, total: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Plays a compiled script against an editor adapter.
 *
 * Two ways to drive it:
 *  - `play()`  — auto mode: steps are applied on their own human-like schedule,
 *    pausing at checkpoints until `resume()`.
 *  - `advance(chars)` — manual ("hacker typer") mode: each call applies the next
 *    few characters instantly. Wire it to keystrokes and mash away.
 */
export class Player {
  private steps: Step[];
  private checkpointIndices: Map<number, string | undefined>;
  private cursor = 0;
  private _state: PlayerState = 'idle';
  private wakeGate: (() => void) | null = null;
  private readonly timeScale: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly onStateChange?: (state: PlayerState) => void;
  private readonly onProgress?: (applied: number, total: number) => void;

  constructor(
    script: CompiledScript | Step[],
    private readonly apply: ApplyFn,
    options: PlayerOptions = {},
  ) {
    if (Array.isArray(script)) {
      this.steps = script;
      this.checkpointIndices = new Map();
    } else {
      this.steps = script.steps;
      this.checkpointIndices = new Map(script.checkpoints.map((c) => [c.index, c.name]));
    }
    this.timeScale = options.timeScale ?? 1;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.onStateChange = options.onStateChange;
    this.onProgress = options.onProgress;
  }

  get state(): PlayerState {
    return this._state;
  }

  get progress(): { applied: number; total: number } {
    return { applied: this.cursor, total: this.steps.length };
  }

  private setState(state: PlayerState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  /** Auto mode. Resolves when the script finishes or is stopped. */
  async play(): Promise<void> {
    if (this._state === 'playing') return;
    this.setState('playing');

    // Steps are scheduled against a wall-clock timeline rather than slept for
    // one by one. If the host throttles timers (e.g. Chrome clamps setTimeout
    // to 1s in hidden tabs), the loop catches up by applying every overdue
    // step at once, so overall pacing survives.
    let timeline = this.now();

    while (this.cursor < this.steps.length) {
      if ((this._state as PlayerState) === 'stopped') return;

      if (this._state === 'paused' || this._state === 'waiting-checkpoint') {
        await this.blockUntilWoken();
        timeline = this.now();
        continue;
      }

      if (this.checkpointIndices.has(this.cursor)) {
        this.checkpointIndices.delete(this.cursor);
        this.setState('waiting-checkpoint');
        continue;
      }

      const step = this.steps[this.cursor];
      timeline += step.delayMs * this.timeScale;
      const wait = timeline - this.now();
      if (this.timeScale > 0 && wait > 0) {
        await this.sleep(wait);
      }
      // State may have changed while sleeping (pause/stop) — re-check before applying.
      if ((this._state as PlayerState) !== 'playing') {
        timeline -= step.delayMs * this.timeScale;
        continue;
      }

      await this.apply(step.event);
      this.cursor++;
      this.onProgress?.(this.cursor, this.steps.length);
    }

    if (this._state !== ('stopped' as PlayerState)) {
      this.setState('done');
    }
  }

  pause(): void {
    if (this._state === 'playing') {
      this.setState('paused');
    }
  }

  resume(): void {
    if (this._state === 'paused' || this._state === 'waiting-checkpoint') {
      this.setState('playing');
      this.wake();
    }
  }

  stop(): void {
    if (this._state === 'done' || this._state === 'stopped') return;
    this.setState('stopped');
    this.wake();
  }

  private advanceQueue: Promise<unknown> = Promise.resolve();

  /**
   * Manual mode: immediately apply steps until roughly `chars` characters have
   * been inserted. Typo bursts are applied whole so a keystroke never strands
   * the buffer mid-correction. Returns false once the script is exhausted.
   *
   * Overlapping calls are serialized: keystrokes can arrive faster than an
   * async `apply` resolves, and interleaved runs would double-apply steps.
   */
  advance(chars = 3): Promise<boolean> {
    const run = this.advanceQueue.then(() => this.advanceNow(chars));
    this.advanceQueue = run.catch(() => undefined);
    return run;
  }

  private async advanceNow(chars: number): Promise<boolean> {
    if (this._state === 'playing') return true;
    if (this.cursor >= this.steps.length) {
      this.setState('done');
      return false;
    }
    if (this._state !== 'done' && this._state !== 'stopped') {
      this.setState('paused');
    }

    let inserted = 0;
    while (this.cursor < this.steps.length) {
      const step = this.steps[this.cursor];
      // Typo fix-up steps are never a stopping point — a keystroke must not
      // strand a wrong character on screen.
      if (inserted >= chars && !step.typo) break;
      await this.apply(step.event);
      this.cursor++;
      if (step.event.kind === 'insert') {
        inserted += step.event.text.length;
      }
    }

    this.onProgress?.(this.cursor, this.steps.length);
    if (this.cursor >= this.steps.length) {
      this.setState('done');
      return false;
    }
    return true;
  }

  private blockUntilWoken(): Promise<void> {
    return new Promise((resolve) => {
      this.wakeGate = resolve;
    });
  }

  private wake(): void {
    this.wakeGate?.();
    this.wakeGate = null;
  }
}
