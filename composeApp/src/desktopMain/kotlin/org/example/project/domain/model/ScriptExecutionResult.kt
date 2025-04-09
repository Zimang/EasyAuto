package org.example.project.domain.model

data class ScriptExecutionResult(
    val success: Boolean,
    val output: String = "",
    val error: String? = null
)

