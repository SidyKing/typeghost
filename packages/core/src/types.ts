/** A single editor mutation the host adapter must apply at the cursor. */
export type EditEvent =
  | { kind: 'insert'; text: string }
  | { kind: 'backspace'; count: number };

/** One unit of playback: wait `delayMs`, then apply `event`. */
export interface Step {
  event: EditEvent;
  delayMs: number;
  /**
   * Marks the fix-up steps of a simulated typo (backspace + correct char).
   * Playback must never stop right before one of these.
   */
  typo?: boolean;
}

export interface Checkpoint {
  /** Index into `steps` before which auto playback pauses until resume(). */
  index: number;
  name?: string;
}

export interface CompiledScript {
  steps: Step[];
  checkpoints: Checkpoint[];
  /** The source with TypeGhost directives stripped — exactly what ends up on screen. */
  cleanSource: string;
}

export interface HumanizeOptions {
  /** Average typing speed in characters per second. */
  cps: number;
  /** 0..1 — how irregular the rhythm is. */
  jitter: number;
  /** Extra pause after punctuation like `{ } ( ) ; , .` */
  punctuationPauseMs: number;
  /** Extra pause after a newline (reading the next line in your head). */
  newlinePauseMs: number;
  /** Probability per character of a longer "thinking" pause. */
  thinkRate: number;
  /** Base duration of a thinking pause. */
  thinkPauseMs: number;
  /** Probability per letter of a simulated typo (typed, noticed, fixed). 0 disables. */
  typoRate: number;
  /** Seed for deterministic playback (useful for tests and reproducible demos). */
  seed?: number;
}

export const DEFAULT_HUMANIZE: HumanizeOptions = {
  cps: 14,
  jitter: 0.6,
  punctuationPauseMs: 160,
  newlinePauseMs: 420,
  thinkRate: 0.012,
  thinkPauseMs: 900,
  typoRate: 0.025,
};
