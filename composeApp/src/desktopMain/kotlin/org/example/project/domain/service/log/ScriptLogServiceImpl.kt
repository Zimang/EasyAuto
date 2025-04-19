package org.example.project.domain.service.log

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import org.example.project.domain.service.adb.ADBPATH
import java.io.BufferedReader
import java.io.InputStreamReader

class ScriptLogServiceImpl(private val adbPath: String= ADBPATH) : ScriptLogService {

    override suspend fun captureLogSegment(
        transportId: String,
        startFlag: String,
        endFlag: String,
        timeoutMillis: Long
    ): Result<List<String>> = withContext(Dispatchers.IO) {
        val logs = mutableListOf<String>()
        var started = false
        val process = ProcessBuilder(adbPath, "-s", transportId, "logcat", "-v", "time")
            .redirectErrorStream(true)
            .start()

        val reader = BufferedReader(InputStreamReader(process.inputStream))

        val deadline = System.currentTimeMillis() + timeoutMillis
        while (System.currentTimeMillis() < deadline) {
            val line = reader.readLine() ?: break
            if (!started && startFlag in line) {
                started = true
                logs.add(line)
            } else if (started) {
                logs.add(line)
                if (endFlag in line) {
                    process.destroy()
                    return@withContext Result.success(logs)
                }
            }
        }

        process.destroy()
        return@withContext Result.failure(Exception("Log capture timed out or end flag not found"))
    }

    override fun observeLogs(
        transportId: String,
        filter: (String) -> Boolean
    ): Flow<String> = callbackFlow {
        val process = ProcessBuilder(adbPath, "-s", transportId, "logcat", "-v", "time")
            .redirectErrorStream(true)
            .start()

        val reader = BufferedReader(InputStreamReader(process.inputStream))

        val thread = Thread {
            try {
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    if (line != null && filter(line!!)) trySend(line!!)
                }
            } catch (_: Exception) {
            } finally {
                process.destroy()
                close()
            }
        }
        thread.start()

        awaitClose {
            process.destroy()
            thread.interrupt()
        }
    }
}
