package org.example.project.domain.service.adb

import org.example.project.domain.model.ShellResult
import java.io.File

interface ShellExecutor {
    suspend fun exec(
        command: List<String>,
        workingDir: File? = null
    ): ShellResult
}