package com.typeghost.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Minimal in-memory "editor": inserts at end, backspaces from end. */
private class Buffer {
    var text = ""
        private set

    fun apply(event: EditEvent) {
        when (event) {
            is EditEvent.Insert -> text += event.text
            is EditEvent.Backspace -> text = text.dropLast(event.count)
        }
    }
}

/** Fires every task synchronously, advancing a virtual clock by the requested delay. */
private class ImmediateScheduler : Scheduler {
    var clock = 0L
    var scheduleCount = 0

    override fun schedule(delayMs: Long, task: () -> Unit): Cancellable {
        scheduleCount++
        clock += delayMs
        task()
        return Cancellable { }
    }
}

/** Queues tasks so tests can interleave pause/resume between steps. */
private class QueueScheduler : Scheduler {
    var clock = 0L
    private val tasks = ArrayDeque<Pair<Long, () -> Unit>>()

    override fun schedule(delayMs: Long, task: () -> Unit): Cancellable {
        val entry = delayMs to task
        tasks += entry
        return Cancellable { tasks.remove(entry) }
    }

    fun runNext(): Boolean {
        val (delay, task) = tasks.removeFirstOrNull() ?: return false
        clock += delay
        task()
        return true
    }

    fun drain() {
        while (runNext()) Unit
    }
}

class ScriptParserTest {
    @Test
    fun `strips directives and keeps the rest byte-exact`() {
        val source = "line1\n//~ pause 800\nline2\n#~ checkpoint intro\nline3\n"
        val segments = ScriptParser.parseDirectives(source)
        assertEquals(
            listOf(
                Segment.Text("line1\n"),
                Segment.Pause(800),
                Segment.Text("line2\n"),
                Segment.CheckpointMark("intro"),
                Segment.Text("line3\n"),
            ),
            segments,
        )
    }

    @Test
    fun `does not treat regular comments as directives`() {
        val source = "// a normal comment\n# ~ not glued, not a directive\n"
        assertEquals(listOf<Segment>(Segment.Text(source)), ScriptParser.parseDirectives(source))
    }

    @Test
    fun `compile produces a clean source and checkpoint indices`() {
        val source = "//~ checkpoint\nconsole.log(1);\n//~ pause 500\nconsole.log(2);\n"
        val script = ScriptParser.compile(source, HumanizeOptions(typoRate = 0.0, seed = 1))
        assertEquals("console.log(1);\nconsole.log(2);\n", script.cleanSource)
        assertEquals(listOf(Checkpoint(0, null)), script.checkpoints)
    }
}

class HumanizerTest {
    @Test
    fun `reproduces the input exactly when typos are disabled`() {
        val text = "function add(a, b) {\n  return a + b;\n}\n"
        val steps = Humanizer.humanize(text, HumanizeOptions(typoRate = 0.0, seed = 42))
        val buffer = Buffer()
        steps.forEach { buffer.apply(it.event) }
        assertEquals(text, buffer.text)
        assertEquals(text.codePointCount(0, text.length), steps.size)
    }

    @Test
    fun `still converges to the input when every letter gets a typo`() {
        val text = "const ghost = \"typeghost\";\n"
        val steps = Humanizer.humanize(text, HumanizeOptions(typoRate = 1.0, seed = 7))
        val buffer = Buffer()
        steps.forEach { buffer.apply(it.event) }
        assertEquals(text, buffer.text)
        assertTrue(steps.size > text.length)
    }

    @Test
    fun `is deterministic for a given seed`() {
        val a = Humanizer.humanize("hello world", HumanizeOptions(seed = 123))
        val b = Humanizer.humanize("hello world", HumanizeOptions(seed = 123))
        assertEquals(a, b)
    }
}

class PlayerTest {
    private fun compiled(source: String) =
        ScriptParser.compile(source, HumanizeOptions(typoRate = 0.0, seed = 5))

    @Test
    fun `applies the whole script in auto mode`() {
        val source = "const x = 1;\n"
        val buffer = Buffer()
        val scheduler = ImmediateScheduler()
        val player = Player(compiled(source), buffer::apply, scheduler, now = { scheduler.clock })
        player.play()
        assertEquals(source, buffer.text)
        assertEquals(PlayerState.DONE, player.state)
    }

    @Test
    fun `waits at checkpoints until resumed`() {
        val source = "a\n//~ checkpoint half\nb\n"
        val buffer = Buffer()
        val scheduler = ImmediateScheduler()
        val player = Player(compiled(source), buffer::apply, scheduler, now = { scheduler.clock })

        player.play()
        assertEquals(PlayerState.WAITING_CHECKPOINT, player.state)
        assertEquals("a\n", buffer.text)

        player.resume()
        assertEquals("a\nb\n", buffer.text)
        assertEquals(PlayerState.DONE, player.state)
    }

    @Test
    fun `can be paused and resumed`() {
        val source = "abcdef"
        val buffer = Buffer()
        val scheduler = QueueScheduler()
        val player = Player(compiled(source), buffer::apply, scheduler, now = { scheduler.clock })

        player.pause() // pausing before play() is a no-op
        player.play()
        scheduler.runNext()
        scheduler.runNext()
        player.pause()
        val frozen = buffer.text
        assertFalse(scheduler.runNext(), "pause must cancel the pending timer")
        assertEquals(frozen, buffer.text)

        player.resume()
        scheduler.drain()
        assertEquals(source, buffer.text)
        assertEquals(PlayerState.DONE, player.state)
    }

    @Test
    fun `catches up when the host throttles timers`() {
        // Simulate a clamped timer: the clock jumps 1000ms per schedule,
        // no matter what was requested.
        val steps = List(40) { Step(EditEvent.Insert("x"), 50) }
        val script = CompiledScript(steps, emptyList(), "x".repeat(40))
        val buffer = Buffer()
        var clock = 0L
        var scheduleCount = 0
        val throttled = Scheduler { _, task ->
            scheduleCount++
            clock += 1000
            task()
            Cancellable { }
        }
        val player = Player(script, buffer::apply, throttled, now = { clock })
        player.play()
        // 40 × 50ms = 2s of virtual typing; with 1s throttled ticks the player
        // must burst-apply overdue steps instead of scheduling 40 times.
        assertEquals("x".repeat(40), buffer.text)
        assertTrue(scheduleCount <= 4, "expected few schedules, got $scheduleCount")
    }

    @Test
    fun `advances manually, finishing typo bursts atomically`() {
        val text = "abc"
        val steps = Humanizer.humanize(text, HumanizeOptions(typoRate = 1.0, seed = 9))
        val script = CompiledScript(steps, emptyList(), text)
        val buffer = Buffer()
        val player = Player(script, buffer::apply, ImmediateScheduler())

        var alive = true
        while (alive) {
            alive = player.advance(1)
            // A typo burst must never leave a dangling wrong character.
            assertTrue(text.startsWith(buffer.text), "unexpected buffer: '${buffer.text}'")
        }
        assertEquals(text, buffer.text)
        assertEquals(PlayerState.DONE, player.state)
    }

    @Test
    fun `reports being exhausted`() {
        val steps = Humanizer.humanize("x", HumanizeOptions(typoRate = 0.0, seed = 1))
        val player = Player(CompiledScript(steps, emptyList(), "x"), {}, ImmediateScheduler())
        assertFalse(player.advance(10))
        assertFalse(player.advance(10))
    }
}
