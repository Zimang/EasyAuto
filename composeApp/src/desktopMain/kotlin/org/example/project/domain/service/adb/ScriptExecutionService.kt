package org.example.project.domain.service.adb

import org.example.project.domain.model.ScriptExecutionResult
import java.io.File

interface ScriptExecutionService {
    suspend fun runScriptOnDevice(
        transportId: String,
        scriptFile: File,
        resources: List<File> = emptyList()
    ): ScriptExecutionResult
}