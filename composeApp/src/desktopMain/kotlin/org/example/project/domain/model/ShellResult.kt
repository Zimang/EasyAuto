package org.example.project.domain.model

data class ShellResult(
    val exitCode: Int,
    val stdout: String,
    val stderr: String
) {
    fun isSuccess(): Boolean = exitCode == 0
}