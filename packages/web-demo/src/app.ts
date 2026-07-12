import { compileScript, EditEvent, Player, PlayerState } from '@typeghost/core';

declare global {
  interface Window {
    initTypeGhostDemo(monaco: typeof import('monaco-editor')): void;
  }
}

type Monaco = typeof import('monaco-editor');

const SAMPLE = `// TypeGhost demo — press ▶ Play and watch
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
//~ pause 800

//~ checkpoint explain-before-continuing
const series = [];
for (let i = 0; i < 10; i++) {
  series.push(fibonacci(i));
}

console.log(series.join(", "));
`;

window.initTypeGhostDemo = (monaco: Monaco) => {
  const scriptArea = document.getElementById('script') as HTMLTextAreaElement;
  const statusEl = document.getElementById('status') as HTMLSpanElement;
  const playBtn = document.getElementById('play') as HTMLButtonElement;
  const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop') as HTMLButtonElement;
  const hackerBtn = document.getElementById('hacker') as HTMLButtonElement;
  const speedInput = document.getElementById('speed') as HTMLInputElement;
  const typosInput = document.getElementById('typos') as HTMLInputElement;

  scriptArea.value = SAMPLE;

  const editor = monaco.editor.create(document.getElementById('editor')!, {
    value: '',
    language: 'javascript',
    theme: 'vs-dark',
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
  });

  let player: Player | undefined;
  let offset = 0;
  let hackerMode = false;

  const apply = (event: EditEvent) => {
    const model = editor.getModel()!;
    if (event.kind === 'insert') {
      const pos = model.getPositionAt(offset);
      model.applyEdits([
        { range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: event.text },
      ]);
      offset += event.text.length;
    } else {
      const start = model.getPositionAt(offset - event.count);
      const end = model.getPositionAt(offset);
      model.applyEdits([
        { range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: '' },
      ]);
      offset -= event.count;
    }
    const caret = model.getPositionAt(offset);
    editor.setPosition(caret);
    editor.revealPositionInCenterIfOutsideViewport(caret);
  };

  const setStatus = (text: string) => {
    statusEl.textContent = text;
  };

  const onStateChange = (state: PlayerState) => {
    playBtn.disabled = state === 'playing';
    pauseBtn.disabled = !(state === 'playing' || state === 'paused' || state === 'waiting-checkpoint');
    stopBtn.disabled = state === 'done' || state === 'stopped' || state === 'idle';
    switch (state) {
      case 'playing':
        setStatus(hackerMode ? 'Hacker mode — mash your keyboard!' : 'Typing…');
        break;
      case 'paused':
        setStatus(hackerMode ? 'Hacker mode — mash your keyboard!' : 'Paused.');
        break;
      case 'waiting-checkpoint':
        setStatus('Checkpoint — talk to your audience, then press ⏸ to continue.');
        break;
      case 'done':
        setStatus('Done. Your audience is impressed. 🎉');
        break;
      case 'stopped':
        setStatus('Stopped.');
        break;
      default:
        break;
    }
  };

  const freshPlayer = (typosAllowed: boolean) => {
    player?.stop();
    editor.getModel()!.setValue('');
    offset = 0;
    const script = compileScript(scriptArea.value, {
      cps: Number(speedInput.value),
      typoRate: typosAllowed && typosInput.checked ? 0.04 : 0,
    });
    player = new Player(script, apply, { onStateChange });
    return player;
  };

  playBtn.addEventListener('click', () => {
    hackerMode = false;
    hackerBtn.textContent = '🕶 Hacker mode';
    void freshPlayer(true).play();
  });

  pauseBtn.addEventListener('click', () => {
    if (!player) return;
    if (player.state === 'playing') {
      player.pause();
    } else {
      player.resume();
    }
    editor.focus();
  });

  stopBtn.addEventListener('click', () => {
    player?.stop();
    hackerMode = false;
    hackerBtn.textContent = '🕶 Hacker mode';
  });

  hackerBtn.addEventListener('click', () => {
    if (hackerMode) {
      hackerMode = false;
      hackerBtn.textContent = '🕶 Hacker mode';
      player?.stop();
      return;
    }
    hackerMode = true;
    hackerBtn.textContent = '🛑 Exit hacker mode';
    freshPlayer(false);
    setStatus('Hacker mode — click the editor and mash your keyboard!');
    editor.focus();
  });

  editor.onKeyDown((e) => {
    if (!hackerMode || !player) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    void player.advance(3).then((alive) => {
      if (!alive) {
        hackerMode = false;
        hackerBtn.textContent = '🕶 Hacker mode';
      }
    });
  });
};
