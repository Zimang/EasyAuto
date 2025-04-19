package org.example.project.domain.service.adb

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

//const val ADBPATH="C:\\Users\\Admin\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"
const val ADBPATH="adb.exe"

class AdbServiceImpl(
    private val adbPath: String = ADBPATH  // e.g. "/usr/bin/adb"
) : AdbService {

    override suspend fun captureScreenshot(transportId: String): BufferedImage {
        val tempFile = File.createTempFile("screenshot", ".png")

        val process = ProcessBuilder(
//            adbPath, "-t", transportId,
            adbPath, "-s", transportId,
            "exec-out", "screencap", "-p"
        ).redirectOutput(tempFile).start()

        if (process.waitFor() != 0) {
            throw RuntimeException("截图失败，exit=${process.exitValue()}")
        }

        return ImageIO.read(tempFile)
            ?: throw IllegalArgumentException("无法解析截图图像")
    }

    override suspend fun pushFile(
        deviceId: String,
        localFile: File,
        remotePath: String
    ): Result<Unit> = runCatching {
        val process = ProcessBuilder(
//            adbPath, "-t", deviceId,
            adbPath, "-s", deviceId,
            "push", localFile.absolutePath, remotePath
        ).start()

        val exitCode = process.waitFor()
        if (exitCode != 0) {
            val error = process.errorStream.bufferedReader().readText()
            throw RuntimeException("推送文件失败：$error")
        }
    }

    override suspend fun pushFile(deviceId: String, localFile: BufferedImage, remotePath: String): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                // 写入临时文件
                val tempFile = File.createTempFile("buffered_image_", ".png")
                ImageIO.write(localFile, "png", tempFile)
                val result = pushFile(deviceId, tempFile, remotePath)
                tempFile.delete() // 清理临时文件
                result
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }


}

//private fun main() = runBlocking {
//    val adbPath = ADBPATH
//    val transportId = "2" // 🔁 改成实际设备 ID
//
//    val adbService = AdbServiceImpl(adbPath)
//
//    try {
//        val image: BufferedImage = adbService.captureScreenshot(transportId)
//        val output = File("screenshot_test.png")
//        ImageIO.write(image, "png", output)
//        println("✅ 截图成功！保存在: ${output.absolutePath}")
//    } catch (e: Exception) {
//        println("❌ 截图失败: ${e.message}")
//    }
//}