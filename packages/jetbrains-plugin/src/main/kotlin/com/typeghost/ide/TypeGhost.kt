package com.typeghost.ide

import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.ScrollType
import com.intellij.openapi.editor.actionSystem.TypedAction
import com.intellij.openapi.editor.actionSystem.TypedActionHandler
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.WindowManager
import com.typeghost.engine.Cancellable
import com.typeghost.engine.EditEvent
import com.typeghost.engine.HumanizeOptions
import com.typeghost.engine.Player
import com.typeghost.engine.PlayerState
import com.typeghost.engine.Scheduler
import com.typeghost.engine.ScriptParser
import javax.swing.Timer

enum class Mode { AUTO, HACKER }

/** Swing-timer scheduler: fires on the EDT, which is where all edits belong. */
private object SwingScheduler : Scheduler {
    override fun schedule(delayMs: Long, task: () -> Unit): Cancellable {
        val timer = Timer(delayMs.coerceAtLeast(1).toInt()) { task() }
        timer.isRepeats = false
        timer.start()
        return Cancellable { timer.stop() }
    }
}

/** One active session at a time, like the VS Code extension. */
object TypeGhost {
    const val CHARS_PER_KEYSTROKE = 3

    var session: Session? = null
        private set

    fun start(project: Project, editor: Editor, source: String, mode: Mode) {
        stop()
        // In hacker mode the presenter's own rhythm sells the illusion;
        // simulated typos would just look like the script glitching.
        val opts = if (mode == Mode.AUTO) HumanizeOptions() else HumanizeOptions(typoRate = 0.0)
        val script = ScriptParser.compile(source, opts)
        val newSession = Session(project, editor, script, mode)
        session = newSession
        newSession.begin()
    }

    fun stop() {
        session?.dispose()
        session = null
    }
}

class Session(
    private val project: Project,
    private val editor: Editor,
    script: com.typeghost.engine.CompiledScript,
    val mode: Mode,
) {
    private var offset = editor.caretModel.offset
    private var originalTypedHandler: TypedActionHandler? = null

    val player = Player(
        script,
        apply = ::applyEdit,
        scheduler = SwingScheduler,
        onStateChange = ::onStateChange,
    )

    fun begin() {
        if (mode == Mode.AUTO) {
            player.play()
        } else {
            installHackerHandler()
            status("hacker mode — mash any keys!")
        }
    }

    private fun applyEdit(event: EditEvent) {
        val document = editor.document
        WriteCommandAction.runWriteCommandAction(project) {
            when (event) {
                is EditEvent.Insert -> {
                    document.insertString(offset, event.text)
                    offset += event.text.length
                }
                is EditEvent.Backspace -> {
                    document.deleteString(offset - event.count, offset)
                    offset -= event.count
                }
            }
        }
        editor.caretModel.moveToOffset(offset)
        editor.scrollingModel.scrollToCaret(ScrollType.MAKE_VISIBLE)
    }

    private fun installHackerHandler() {
        val typedAction = TypedAction.getInstance()
        originalTypedHandler = typedAction.rawHandler
        typedAction.setupRawHandler(object : TypedActionHandler {
            override fun execute(e: Editor, charTyped: Char, dataContext: DataContext) {
                val current = TypeGhost.session
                if (current === this@Session && current.mode == Mode.HACKER) {
                    // The pressed key is deliberately ignored — the script decides.
                    if (!current.player.advance(TypeGhost.CHARS_PER_KEYSTROKE)) {
                        status("script finished 🎉")
                        TypeGhost.stop()
                    }
                } else {
                    originalTypedHandler?.execute(e, charTyped, dataContext)
                }
            }
        })
    }

    fun dispose() {
        player.stop()
        originalTypedHandler?.let { TypedAction.getInstance().setupRawHandler(it) }
        originalTypedHandler = null
    }

    private fun onStateChange(state: PlayerState) {
        when (state) {
            PlayerState.PLAYING -> status(if (mode == Mode.HACKER) "hacker mode — mash any keys!" else "typing…")
            PlayerState.PAUSED -> status(if (mode == Mode.HACKER) "hacker mode — mash any keys!" else "paused")
            PlayerState.WAITING_CHECKPOINT -> status("checkpoint — Pause/Resume to continue")
            PlayerState.DONE -> status("done 🎉")
            PlayerState.STOPPED -> status("stopped")
            PlayerState.IDLE -> Unit
        }
    }

    private fun status(text: String) {
        WindowManager.getInstance().getStatusBar(project)?.info = "👻 TypeGhost: $text"
    }
}
