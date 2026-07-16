import * as vscode from 'vscode';
import { compileScript, EditEvent, Player, PlayerState } from 'typeghost-core';

type Mode = 'auto' | 'hacker';

interface Session {
  player: Player;
  mode: Mode;
  editor: vscode.TextEditor;
  offset: number;
  typeOverride?: vscode.Disposable;
}

let session: Session | undefined;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'typeghost.stop';
  context.subscriptions.push(
    statusBar,
    vscode.commands.registerCommand('typeghost.playFromClipboard', () =>
      startSession('auto', 'clipboard'),
    ),
    vscode.commands.registerCommand('typeghost.playFromFile', () => startSession('auto', 'file')),
    vscode.commands.registerCommand('typeghost.hackerModeFromClipboard', () =>
      startSession('hacker', 'clipboard'),
    ),
    vscode.commands.registerCommand('typeghost.hackerModeFromFile', () =>
      startSession('hacker', 'file'),
    ),
    vscode.commands.registerCommand('typeghost.pauseResume', pauseResume),
    vscode.commands.registerCommand('typeghost.stop', stopSession),
  );
}

export function deactivate(): void {
  stopSession();
}

async function readSource(from: 'clipboard' | 'file'): Promise<string | undefined> {
  if (from === 'clipboard') {
    const text = await vscode.env.clipboard.readText();
    if (!text) {
      void vscode.window.showWarningMessage('TypeGhost: the clipboard is empty.');
      return undefined;
    }
    return text;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Type this file',
  });
  if (!picked || picked.length === 0) return undefined;
  const bytes = await vscode.workspace.fs.readFile(picked[0]);
  return new TextDecoder('utf-8').decode(bytes);
}

async function startSession(mode: Mode, from: 'clipboard' | 'file'): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('TypeGhost: open an editor to type into first.');
    return;
  }
  const source = await readSource(from);
  if (source === undefined) return;

  stopSession();

  const config = vscode.workspace.getConfiguration('typeghost');
  const script = compileScript(source, {
    cps: config.get<number>('charsPerSecond', 14),
    // In hacker mode the presenter's own rhythm sells the illusion; simulated
    // typos would just look like the script glitching.
    typoRate:
      mode === 'auto' && config.get<boolean>('typos', true)
        ? config.get<number>('typoRate', 0.025)
        : 0,
  });

  const current: Session = {
    mode,
    editor,
    offset: editor.document.offsetAt(editor.selection.active),
    player: undefined as unknown as Player,
  };

  current.player = new Player(script, (event) => applyEdit(current, event), {
    onStateChange: (state) => onStateChange(current, state),
  });
  session = current;
  void vscode.commands.executeCommand('setContext', 'typeghost.active', true);

  if (mode === 'hacker') {
    try {
      current.typeOverride = vscode.commands.registerCommand('type', (args: { text: string }) =>
        onHackerKeystroke(current, args),
      );
    } catch {
      void vscode.window.showErrorMessage(
        'TypeGhost: another extension (Vim?) already owns the keyboard. Disable it and retry.',
      );
      stopSession();
      return;
    }
    updateStatusBar('hacker: mash any keys!');
  } else {
    await current.player.play();
  }
}

async function applyEdit(current: Session, event: EditEvent): Promise<void> {
  const { editor } = current;
  const doc = editor.document;
  const editOptions = { undoStopBefore: false, undoStopAfter: false };

  if (event.kind === 'insert') {
    const pos = doc.positionAt(current.offset);
    await editor.edit((builder) => builder.insert(pos, event.text), editOptions);
    current.offset += event.text.length;
  } else {
    const start = doc.positionAt(current.offset - event.count);
    const end = doc.positionAt(current.offset);
    await editor.edit((builder) => builder.delete(new vscode.Range(start, end)), editOptions);
    current.offset -= event.count;
  }

  const caret = doc.positionAt(current.offset);
  editor.selection = new vscode.Selection(caret, caret);
  editor.revealRange(new vscode.Range(caret, caret), vscode.TextEditorRevealType.Default);
}

async function onHackerKeystroke(current: Session, args: { text: string }): Promise<void> {
  const chars = vscode.workspace
    .getConfiguration('typeghost')
    .get<number>('charsPerKeystroke', 3);
  const alive = await current.player.advance(chars);
  if (!alive) {
    updateStatusBar('script finished 🎉');
    stopSession();
  }
  void args; // the pressed key is deliberately ignored — the script decides.
}

function pauseResume(): void {
  if (!session) return;
  if (session.player.state === 'playing') {
    session.player.pause();
  } else {
    session.player.resume();
  }
}

function stopSession(): void {
  if (!session) return;
  session.typeOverride?.dispose();
  session.player.stop();
  session = undefined;
  statusBar.hide();
  void vscode.commands.executeCommand('setContext', 'typeghost.active', false);
}

function onStateChange(current: Session, state: PlayerState): void {
  if (session !== current) return;
  switch (state) {
    case 'playing':
      updateStatusBar('typing…');
      break;
    case 'paused':
      updateStatusBar(
        current.mode === 'hacker' ? 'hacker: mash any keys!' : 'paused (ctrl/cmd+alt+T to resume)',
      );
      break;
    case 'waiting-checkpoint':
      updateStatusBar('checkpoint — ctrl/cmd+alt+T to continue');
      break;
    case 'done':
      updateStatusBar('done 🎉');
      setTimeout(() => statusBar.hide(), 3000);
      break;
    default:
      break;
  }
}

function updateStatusBar(text: string): void {
  statusBar.text = `👻 TypeGhost: ${text}`;
  statusBar.tooltip = 'Click to stop TypeGhost';
  statusBar.show();
}
