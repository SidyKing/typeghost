package com.typeghost.engine

enum class PlayerState { IDLE, PLAYING, PAUSED, WAITING_CHECKPOINT, DONE, STOPPED }

fun interface Cancellable {
    fun cancel()
}

/** Host-provided timer. In the IDE this is a Swing timer; tests inject fakes. */
fun interface Scheduler {
    fun schedule(delayMs: Long, task: () -> Unit): Cancellable
}

/**
 * Plays a compiled script against an editor adapter. Everything runs on a
 * single thread (the EDT in the IDE), driven by [Scheduler] callbacks.
 *
 * Two ways to drive it:
 *  - [play] — auto mode: steps are applied on their own human-like schedule,
 *    pausing at checkpoints until [resume].
 *  - [advance] — manual ("hacker typer") mode: each call applies the next few
 *    characters instantly. Wire it to keystrokes and mash away.
 *
 * Steps are scheduled against a wall-clock timeline rather than one-by-one:
 * if the host throttles timers, the loop catches up by applying every overdue
 * step at once, so overall pacing survives.
 */
class Player(
    script: CompiledScript,
    private val apply: (EditEvent) -> Unit,
    private val scheduler: Scheduler,
    private val timeScale: Double = 1.0,
    private val now: () -> Long = System::currentTimeMillis,
    private val onStateChange: (PlayerState) -> Unit = {},
) {
    private val steps = script.steps
    private val checkpointIndices = script.checkpoints.map { it.index }.toMutableSet()
    private var cursor = 0
    private var timeline = 0L
    /** Due time of steps[cursor], so a timer wake-up never re-adds its delay. */
    private var nextDue: Long? = null
    private var pending: Cancellable? = null

    var state: PlayerState = PlayerState.IDLE
        private set

    private fun setState(newState: PlayerState) {
        state = newState
        onStateChange(newState)
    }

    fun play() {
        if (state == PlayerState.PLAYING || state == PlayerState.DONE || state == PlayerState.STOPPED) return
        setState(PlayerState.PLAYING)
        timeline = now()
        pump()
    }

    private fun pump() {
        while (state == PlayerState.PLAYING) {
            if (cursor >= steps.size) {
                setState(PlayerState.DONE)
                return
            }
            if (checkpointIndices.remove(cursor)) {
                setState(PlayerState.WAITING_CHECKPOINT)
                return
            }
            val step = steps[cursor]
            val due = nextDue ?: (timeline + (step.delayMs * timeScale).toLong()).also {
                nextDue = it
                timeline = it
            }
            val wait = due - now()
            if (wait > 0) {
                pending = scheduler.schedule(wait) {
                    pending = null
                    pump()
                }
                return
            }
            apply(step.event)
            cursor++
            nextDue = null
        }
    }

    fun pause() {
        if (state != PlayerState.PLAYING) return
        pending?.cancel()
        pending = null
        setState(PlayerState.PAUSED)
    }

    fun resume() {
        if (state != PlayerState.PAUSED && state != PlayerState.WAITING_CHECKPOINT) return
        setState(PlayerState.PLAYING)
        timeline = now()
        nextDue = null
        pump()
    }

    fun stop() {
        if (state == PlayerState.DONE || state == PlayerState.STOPPED) return
        pending?.cancel()
        pending = null
        setState(PlayerState.STOPPED)
    }

    /**
     * Manual mode: immediately apply steps until roughly [chars] characters
     * have been inserted. Typo bursts are applied whole so a keystroke never
     * strands a wrong character on screen. Returns false once exhausted.
     */
    fun advance(chars: Int = 3): Boolean {
        if (state == PlayerState.PLAYING) return true
        if (cursor >= steps.size) {
            setState(PlayerState.DONE)
            return false
        }
        if (state != PlayerState.DONE && state != PlayerState.STOPPED) {
            setState(PlayerState.PAUSED)
        }

        var inserted = 0
        while (cursor < steps.size) {
            val step = steps[cursor]
            if (inserted >= chars && !step.typo) break
            apply(step.event)
            cursor++
            if (step.event is EditEvent.Insert) inserted += step.event.text.length
        }

        if (cursor >= steps.size) {
            setState(PlayerState.DONE)
            return false
        }
        return true
    }
}
