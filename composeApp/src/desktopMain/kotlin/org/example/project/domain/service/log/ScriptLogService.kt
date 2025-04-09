package org.example.project.domain.service.log

import kotlinx.coroutines.flow.Flow

interface ScriptLogService {
    /**
     * 按标记捕获脚本日志段
     */
    suspend fun captureLogSegment(
        transportId: String,
        startFlag: String,
        endFlag: String,
        timeoutMillis: Long = 5000
    ): Result<List<String>>

    /**
     * 流式观察日志，可加过滤器
     */
    fun observeLogs(
        transportId: String,
        filter: (String) -> Boolean = { true }
    ): Flow<String>
}
