package com.typeghost.engine

sealed interface Segment {
    data class Text(val text: String) : Segment
    data class Pause(val ms: Long) : Segment
    data class CheckpointMark(val name: String?) : Segment
}

/**
 * TypeGhost directives are comment lines with a `~` glued to the comment
 * marker, so they never collide with real comments:
 *
 *     //~ pause 800          extra pause (ms) before the next character
 *     //~ checkpoint intro   auto playback stops here until you resume
 *
 * `#~`, `--~`, `;;~` and `%~` work too. Directive lines are stripped from
 * the typed output.
 */
object ScriptParser {

    private val DIRECTIVE = Regex("""^\s*(?://|#|--|;;|%)~\s*(pause|checkpoint)\b\s*(.*?)\s*$""")

    fun parseDirectives(source: String): List<Segment> {
        val segments = mutableListOf<Segment>()
        val buffer = StringBuilder()

        fun flush() {
            if (buffer.isNotEmpty()) {
                segments += Segment.Text(buffer.toString())
                buffer.clear()
            }
        }

        // Split keeping line terminators so the clean source is byte-exact.
        val lines = mutableListOf<String>()
        var start = 0
        for (idx in source.indices) {
            if (source[idx] == '\n') {
                lines += source.substring(start, idx + 1)
                start = idx + 1
            }
        }
        if (start < source.length) lines += source.substring(start)

        for (line in lines) {
            val match = DIRECTIVE.find(line.removeSuffix("\n").removeSuffix("\r"))
            if (match == null) {
                buffer.append(line)
                continue
            }
            flush()
            val (directive, arg) = match.destructured
            if (directive == "pause") {
                segments += Segment.Pause(arg.toLongOrNull() ?: 500L)
            } else {
                segments += Segment.CheckpointMark(arg.ifEmpty { null })
            }
        }
        flush()
        return segments
    }

    /** Compile source code (with optional directives) into a playable script. */
    fun compile(source: String, opts: HumanizeOptions = HumanizeOptions()): CompiledScript {
        val steps = mutableListOf<Step>()
        val checkpoints = mutableListOf<Checkpoint>()
        val clean = StringBuilder()
        var pendingPause = 0L
        val pendingCheckpoints = mutableListOf<Checkpoint>()

        for (segment in parseDirectives(source)) {
            when (segment) {
                is Segment.Pause -> pendingPause += segment.ms
                is Segment.CheckpointMark -> pendingCheckpoints += Checkpoint(steps.size, segment.name)
                is Segment.Text -> {
                    val humanized = Humanizer.humanize(segment.text, opts).toMutableList()
                    if (humanized.isNotEmpty()) {
                        humanized[0] = humanized[0].copy(delayMs = humanized[0].delayMs + pendingPause)
                        pendingPause = 0
                        checkpoints += pendingCheckpoints
                        pendingCheckpoints.clear()
                    }
                    steps += humanized
                    clean.append(segment.text)
                }
            }
        }
        return CompiledScript(steps, checkpoints, clean.toString())
    }
}
