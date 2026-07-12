import { createRandom } from './random';
import { DEFAULT_HUMANIZE, HumanizeOptions, Step } from './types';

/** QWERTY neighbor keys, used to pick plausible wrong characters for typos. */
const NEIGHBORS: Record<string, string> = {
  a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdr', f: 'drtgvc',
  g: 'ftyhbv', h: 'gyujnb', i: 'ujko', j: 'huikmn', k: 'jiolm', l: 'kop',
  m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa', r: 'edft',
  s: 'awedxz', t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc',
  y: 'tghu', z: 'asx',
};

const PUNCTUATION = new Set(['{', '}', '(', ')', ';', ',', '.', ':', '[', ']']);

/**
 * Turn raw text into a stream of human-looking typing steps:
 * irregular rhythm, longer pauses after newlines/punctuation,
 * occasional thinking pauses and (optionally) corrected typos.
 */
export function humanize(text: string, options: Partial<HumanizeOptions> = {}): Step[] {
  const opts: HumanizeOptions = { ...DEFAULT_HUMANIZE, ...options };
  const rand = createRandom(opts.seed);
  const baseDelay = 1000 / Math.max(opts.cps, 1);
  const steps: Step[] = [];

  let carryPause = 0;

  const charDelay = () => baseDelay * (1 + opts.jitter * (rand() * 2 - 1));

  for (const char of text) {
    let delay = charDelay() + carryPause;
    carryPause = 0;

    if (rand() < opts.thinkRate) {
      delay += opts.thinkPauseMs * (0.5 + rand());
    }

    const lower = char.toLowerCase();
    const neighbors = NEIGHBORS[lower];
    if (opts.typoRate > 0 && neighbors && rand() < opts.typoRate) {
      let wrong = neighbors[Math.floor(rand() * neighbors.length)];
      if (char !== lower) {
        wrong = wrong.toUpperCase();
      }
      // Only the fix-up steps carry `typo: true`: playback may stop before the
      // wrong character, but never between it and its correction.
      steps.push({ event: { kind: 'insert', text: wrong }, delayMs: delay });
      // The pause before backspacing is the "wait, that's not right" moment.
      steps.push({ event: { kind: 'backspace', count: 1 }, delayMs: 140 + rand() * 220, typo: true });
      steps.push({ event: { kind: 'insert', text: char }, delayMs: 90 + rand() * 120, typo: true });
    } else {
      steps.push({ event: { kind: 'insert', text: char }, delayMs: delay });
    }

    if (char === '\n') {
      carryPause += opts.newlinePauseMs * (0.5 + rand());
    } else if (PUNCTUATION.has(char)) {
      carryPause += opts.punctuationPauseMs * rand();
    }
  }

  return steps;
}
