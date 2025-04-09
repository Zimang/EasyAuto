package org.example.project.domain.service.adb

import kotlinx.coroutines.*
import org.example.project.domain.model.ScriptExecutionResult
import org.example.project.domain.service.log.ScriptLogService
import org.example.project.domain.service.log.ScriptLogServiceImpl
import org.example.project.domain.service.adb.ShellExecutor
import org.example.project.domain.service.adb.ShellExecutorImpl
import java.io.File
data class LogCaptureMarker(val start: String, val end: String)
class ScriptExecutionServiceImpl(
    private val adbPath: String= ADBPATH,
    private val shell: ShellExecutor=ShellExecutorImpl(),
    private val logService: ScriptLogService=ScriptLogServiceImpl(), // << 新增注入
    private val marker: LogCaptureMarker = LogCaptureMarker("===TEST_BEGIN===", "===TEST_END===")
) : ScriptExecutionService {

    //TODO 如果是临时文件需要考虑删除
    override suspend fun runScriptOnDevice(
        transportId: String,
        scriptFile: File,
        resources: List<File>
    ): ScriptExecutionResult = coroutineScope {
        val remoteDir = "/sdcard/autojs_test"
        val scriptRemotePath = "$remoteDir/${scriptFile.name}"

        shell.exec(listOf(adbPath, "-t", transportId, "logcat", "-c"))

        // 创建目录
        shell.exec(listOf(adbPath, "-t", transportId, "shell", "mkdir", "-p", remoteDir))

        // push 脚本
        shell.exec(listOf(adbPath, "-t", transportId, "push", scriptFile.absolutePath, scriptRemotePath))

        // push 图片资源
        for (res in resources) {
            val remoteRes = "$remoteDir/${res.name}"
            shell.exec(listOf(adbPath, "-t", transportId, "push", res.absolutePath, remoteRes))
        }


        //异步，有日志就打印
        val logs = mutableListOf<String>()
        val job = CoroutineScope(Dispatchers.IO).launch {
            logService.observeLogs(transportId) {
                it.contains(marker.start) || it.contains(marker.end) || it.contains("GlobalConsole")
            }.collect {
                println("📜 $it") // 实时打印日志
                logs.add(it)
            }
        }

        // 启动 AutoJS
        val launchCommand = listOf(
            adbPath, "-t", transportId,
            "shell", "am", "start",
            "-n", "org.autojs.autoxjs.v6/org.autojs.autojs.external.open.RunIntentActivity",
            "-d", scriptRemotePath
        )
        shell.exec(launchCommand)

        // 等待日志返回
//        val logsResult = logsDeferred.await()
//        return ScriptExecutionResult(
//            success = logsResult.isSuccess,
//            output = logsResult.getOrNull()?.joinToString("\n") ?: "",
//            error = logsResult.exceptionOrNull()?.message
//        )
        // 等待脚本执行结束（基于日志判断）
        withTimeoutOrNull(8000) {
            while (!logs.any { it.contains("===TEST_END===") }) {
                delay(200)
            }
        }

        job.cancelAndJoin()

        return@coroutineScope ScriptExecutionResult(
            success = logs.any { it.contains("===TEST_END===") },
            output = logs.joinToString("\n"),
            error = if (logs.isEmpty()) "No logs captured" else null
        )
    }
}
//
//private fun main() = runBlocking {
//    val adbPath = ADBPATH // 替换成你本地 adb 路径
//    val transportId = "1" // 替换成你当前设备 transportId
//    val shell = ShellExecutorImpl() // 你自己的 shell 实现（可用 ProcessBuilder 封装）
//
//    val scriptService = ScriptExecutionServiceImpl(adbPath, shell, ScriptLogServiceImpl(adbPath))
//
//    // 1. 创建一个临时 js 脚本
//    val tempScriptFile = File.createTempFile("autojs_test_", ".js").apply {
//        writeText(
//            """
//            log("===TEST_BEGIN===");
//            sleep(1000);
//            log("Auto.js 测试执行成功！");
//            log("123");
//            log("321");
//            log("12345");
//            log("54321");
//            sleep(1000);
//            log("===TEST_END===");
//            """.trimIndent()
//        )
//        deleteOnExit()
//    }
//
//    val result = scriptService.runScriptOnDevice(
//        transportId = transportId,
//        scriptFile = tempScriptFile
//    )
//
//}
