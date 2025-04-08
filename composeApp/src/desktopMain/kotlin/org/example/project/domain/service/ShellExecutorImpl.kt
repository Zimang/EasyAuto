package org.example.project.domain.service

import kotlinx.coroutines.runBlocking
import org.example.project.domain.model.ShellResult
import java.io.File

class ShellExecutorImpl : ShellExecutor {

    override suspend fun exec(
        command: List<String>,
        workingDir: File?
    ): ShellResult {
        val process = ProcessBuilder(command)
            .directory(workingDir)
            .redirectErrorStream(false)
            .start()

        val stdout = process.inputStream.bufferedReader().readText()
        val stderr = process.errorStream.bufferedReader().readText()
        val exitCode = process.waitFor()

        return ShellResult(
            exitCode = exitCode,
            stdout = stdout,
            stderr = stderr
        )
    }
}

private fun main()= runBlocking {
    val shell = ShellExecutorImpl()
    val result = shell.exec(listOf(ADBPATH, "-t", "1", "shell", "echo", "hello"))

    if (result.isSuccess()) {
        println("✅ 输出: ${result.stdout}")
    } else {
        println("❌ 错误: ${result.stderr}")
    }
}