package com.typeghost.engine

import kotlin.random.Random

/**
 * Turns raw text into a stream of human-looking typing steps: irregular
 * rhythm, longer pauses after newlines/punctuation, occasional thinking
 * pauses and (optionally) corrected typos.
 *
 * Kotlin port of `typeghost-core` — the TypeScript test suite is the
 * reference specification.
 */
object Humanizer {

    /** QWERTY neighbor keys, used to pick plausible wrong characters for typos. */
    private val NEIGHBORS = mapOf(
        'a' to "qwsz", 'b' to "vghn", 'c' to "xdfv", 'd' to "serfcx", 'e' to "wsdr",
        'f' to "drtgvc", 'g' to "ftyhbv", 'h' to "gyujnb", 'i' to "ujko", 'j' to "huikmn",
        'k' to "jiolm", 'l' to "kop", 'm' to "njk", 'n' to "bhjm", 'o' to "iklp",
        'p' to "ol", 'q' to "wa", 'r' to "edft", 's' to "awedxz", 't' to "rfgy",
        'u' to "yhji", 'v' to "cfgb", 'w' to "qase", 'x' to "zsdc", 'y' to "tghu",
        'z' to "asx",
    )

    private val PUNCTUATION = setOf('{', '}', '(', ')', ';', ',', '.', ':', '[', ']')

    fun humanize(text: String, opts: HumanizeOptions = HumanizeOptions()): List<Step> {
        val rand = opts.seed?.let { Random(it) } ?: Random.Default
        val baseDelay = 1000.0 / maxOf(opts.cps, 1.0)
        val steps = mutableListOf<Step>()
        var carryPause = 0.0

        fun charDelay() = baseDelay * (1 + opts.jitter * (rand.nextDouble() * 2 - 1))

        var i = 0
        while (i < text.length) {
            val codePoint = text.codePointAt(i)
            val charStr = String(Character.toChars(codePoint))
            i += Character.charCount(codePoint)

            var delay = charDelay() + carryPause
            carryPause = 0.0
            if (rand.nextDouble() < opts.thinkRate) {
                delay += opts.thinkPauseMs * (0.5 + rand.nextDouble())
            }

            val char = if (charStr.length == 1) charStr[0] else null
            val lower = char?.lowercaseChar()
            val neighbors = lower?.let { NEIGHBORS[it] }
            if (opts.typoRate > 0 && neighbors != null && rand.nextDouble() < opts.typoRate) {
                var wrong = neighbors[rand.nextInt(neighbors.length)].toString()
                if (char != lower) wrong = wrong.uppercase()
                // Only the fix-up steps carry typo=true: playback may stop before
                // the wrong character, but never between it and its correction.
                steps += Step(EditEvent.Insert(wrong), delay.toLong())
                // The pause before backspacing is the "wait, that's not right" moment.
                steps += Step(EditEvent.Backspace(1), (140 + rand.nextDouble() * 220).toLong(), typo = true)
                steps += Step(EditEvent.Insert(charStr), (90 + rand.nextDouble() * 120).toLong(), typo = true)
            } else {
                steps += Step(EditEvent.Insert(charStr), delay.toLong())
            }

            if (char == '\n') {
                carryPause += opts.newlinePauseMs * (0.5 + rand.nextDouble())
            } else if (char != null && char in PUNCTUATION) {
                carryPause += opts.punctuationPauseMs * rand.nextDouble()
            }
        }
        return steps
    }
}
