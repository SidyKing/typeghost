package com.typeghost.ide

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.VfsUtilCore
import com.typeghost.engine.PlayerState
import java.awt.datatransfer.DataFlavor

private fun activeEditor(e: AnActionEvent) =
    e.getData(CommonDataKeys.EDITOR)
        ?: e.project?.let { FileEditorManager.getInstance(it).selectedTextEditor }

private fun clipboardText(): String? =
    CopyPasteManager.getInstance().getContents(DataFlavor.stringFlavor)

private fun chooseFileText(project: Project): String? {
    val descriptor = FileChooserDescriptorFactory.createSingleFileDescriptor()
        .withTitle("TypeGhost: Choose the Script to Type")
    val file = FileChooser.chooseFile(descriptor, project, null) ?: return null
    return VfsUtilCore.loadText(file)
}

abstract class StartSessionAction(
    private val mode: Mode,
    private val fromFile: Boolean,
) : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.EDT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = activeEditor(e) ?: run {
            Messages.showInfoMessage(project, "Open an editor to type into first.", "TypeGhost")
            return
        }
        val source = if (fromFile) chooseFileText(project) else clipboardText()
        if (source.isNullOrEmpty()) {
            if (!fromFile) Messages.showInfoMessage(project, "The clipboard is empty.", "TypeGhost")
            return
        }
        TypeGhost.start(project, editor, source, mode)
    }
}

class PlayFromClipboardAction : StartSessionAction(Mode.AUTO, fromFile = false)
class PlayFromFileAction : StartSessionAction(Mode.AUTO, fromFile = true)
class HackerFromClipboardAction : StartSessionAction(Mode.HACKER, fromFile = false)
class HackerFromFileAction : StartSessionAction(Mode.HACKER, fromFile = true)

class PauseResumeAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.EDT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = TypeGhost.session != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        val player = TypeGhost.session?.player ?: return
        if (player.state == PlayerState.PLAYING) player.pause() else player.resume()
    }
}

class StopAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.EDT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = TypeGhost.session != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        TypeGhost.stop()
    }
}
