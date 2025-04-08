package org.example.project.domain.service

import kotlinx.coroutines.runBlocking
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

const val ADBPATH="C:\\Users\\Admin\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"

class AdbServiceImpl(
    private val adbPath: String  // e.g. "/usr/bin/adb"
) : AdbService {

    override suspend fun captureScreenshot(transportId: String): BufferedImage {
        val tempFile = File.createTempFile("screenshot", ".png")

        val process = ProcessBuilder(
            adbPath, "-t", transportId,
            "exec-out", "screencap", "-p"
        )
            .redirectOutput(tempFile)
            .start()

        if (process.waitFor() != 0) {
            throw RuntimeException("截图失败，exit=${process.exitValue()}")
        }

        return ImageIO.read(tempFile)
            ?: throw IllegalArgumentException("无法解析截图图像")
    }
}

private fun main() = runBlocking {
    val adbPath = ADBPATH
    val transportId = "1" // 🔁 改成实际设备 ID

    val adbService = AdbServiceImpl(adbPath)

    try {
        val image: BufferedImage = adbService.captureScreenshot(transportId)
        val output = File("screenshot_test.png")
        ImageIO.write(image, "png", output)
        println("✅ 截图成功！保存在: ${output.absolutePath}")
    } catch (e: Exception) {
        println("❌ 截图失败: ${e.message}")
    }
}