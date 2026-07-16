package com.typeghost.engine

/** A single editor mutation the host adapter must apply at the cursor. */
sealed interface EditEvent {
    data class Insert(val text: String) : EditEvent
    data class Backspace(val count: Int) : EditEvent
}

/**
 * One unit of playback: wait [delayMs], then apply [event].
 *
 * [typo] marks the fix-up steps of a simulated typo (backspace + correct
 * char). Playback must never stop right before one of these.
 */
data class Step(val event: EditEvent, val delayMs: Long, val typo: Boolean = false)

/** Index into the step list before which auto playback pauses until resume(). */
data class Checkpoint(val index: Int, val name: String?)

data class CompiledScript(
    val steps: List<Step>,
    val checkpoints: List<Checkpoint>,
    /** The source with TypeGhost directives stripped — exactly what ends up on screen. */
    val cleanSource: String,
)

data class HumanizeOptions(
    /** Average typing speed in characters per second. */
    val cps: Double = 14.0,
    /** 0..1 — how irregular the rhythm is. */
    val jitter: Double = 0.6,
    /** Extra pause after punctuation like `{ } ( ) ; , .` */
    val punctuationPauseMs: Double = 160.0,
    /** Extra pause after a newline (reading the next line in your head). */
    val newlinePauseMs: Double = 420.0,
    /** Probability per character of a longer "thinking" pause. */
    val thinkRate: Double = 0.012,
    /** Base duration of a thinking pause. */
    val thinkPauseMs: Double = 900.0,
    /** Probability per letter of a simulated typo (typed, noticed, fixed). 0 disables. */
    val typoRate: Double = 0.025,
    /** Seed for deterministic playback (tests, reproducible demos). */
    val seed: Long? = null,
)
