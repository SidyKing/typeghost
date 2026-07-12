import { humanize } from './humanizer';
import { Checkpoint, CompiledScript, HumanizeOptions } from './types';

/**
 * TypeGhost directives are comment lines with a `~` glued to the comment
 * marker, so they never collide with real comments:
 *
 *   //~ pause 800          extra pause (ms) before the next character
 *   //~ checkpoint intro   auto playback stops here until you resume
 *
 * `#~`, `--~`, `;;~` and `%~` work too, so any language is covered.
 * Directive lines are stripped from the typed output.
 */
const DIRECTIVE_RE = /^\s*(?:\/\/|#|--|;;|%)~\s*(pause|checkpoint)\b\s*(.*?)\s*$/;

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'pause'; ms: number }
  | { kind: 'checkpoint'; name?: string };

export function parseDirectives(source: string): Segment[] {
  const segments: Segment[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      segments.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  // Split keeping line endings so the clean source is byte-exact.
  const lines = source.split(/(?<=\n)/);
  for (const line of lines) {
    const match = DIRECTIVE_RE.exec(line.replace(/\r?\n$/, ''));
    if (!match) {
      buffer += line;
      continue;
    }
    flush();
    const [, directive, arg] = match;
    if (directive === 'pause') {
      const ms = Number.parseInt(arg, 10);
      segments.push({ kind: 'pause', ms: Number.isFinite(ms) ? ms : 500 });
    } else {
      segments.push({ kind: 'checkpoint', name: arg || undefined });
    }
  }
  flush();
  return segments;
}

/** Compile source code (with optional directives) into a playable script. */
export function compileScript(
  source: string,
  options: Partial<HumanizeOptions> = {},
): CompiledScript {
  const segments = parseDirectives(source);
  const script: CompiledScript = { steps: [], checkpoints: [], cleanSource: '' };
  let pendingPause = 0;
  let pendingCheckpoints: Checkpoint[] = [];

  for (const segment of segments) {
    if (segment.kind === 'pause') {
      pendingPause += segment.ms;
      continue;
    }
    if (segment.kind === 'checkpoint') {
      pendingCheckpoints.push({ index: script.steps.length, name: segment.name });
      continue;
    }
    const steps = humanize(segment.text, options);
    if (steps.length > 0) {
      steps[0].delayMs += pendingPause;
      pendingPause = 0;
      script.checkpoints.push(...pendingCheckpoints);
      pendingCheckpoints = [];
    }
    script.steps.push(...steps);
    script.cleanSource += segment.text;
  }

  return script;
}
