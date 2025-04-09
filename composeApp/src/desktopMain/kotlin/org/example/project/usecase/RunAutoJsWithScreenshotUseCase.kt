package org.example.project.usecase

import kotlinx.coroutines.runBlocking
import org.example.project.domain.model.Rect
import org.example.project.domain.model.ScriptExecutionResult
import org.example.project.domain.service.PlaceholderScriptGenerator
import org.example.project.domain.service.adb.*
import org.example.project.domain.service.image.DefaultImageCropper
import org.example.project.domain.service.image.ImageCropper
import java.io.File
import javax.imageio.ImageIO
import kotlin.random.Random

class RunAutoJsWithScreenshotUseCase(
    private val adbService: AdbService =AdbServiceImpl(),
    private val imageCropper: DefaultImageCropper=DefaultImageCropper(),
    private val scriptGenerator: PlaceholderScriptGenerator?,
    private val scriptExecutionService: ScriptExecutionService=ScriptExecutionServiceImpl(),
) {
    suspend fun execute(deviceId: String): ScriptExecutionResult {
        // 1. 截图并保存到本地
        val screenshot = adbService.captureScreenshot(deviceId)

        val pname="test"+ Random.nextInt(100)
        // 2. 裁剪上半部分（可改为参数）
        val cropped = imageCropper.crop(screenshot, Rect(100, 100, 200,200))
        val tempFile = File.createTempFile("temp_upload", ".png")
        ImageIO.write(cropped, "png", tempFile)


        // 3. 推送图片到模拟器指定路径
        val remotePath = "/sdcard/autojs_test/${pname}.png"
        adbService.pushFile(deviceId, tempFile, remotePath)

        // 4. 替换 imageName 并生成脚本内容
        val scriptContent = PlaceholderScriptGenerator(
            templateName = "templates/temp_demo.js",
            placeholders = mapOf("imageName" to "$pname.png")
        ).generateScript()

        // 5. 创建临时脚本文件（不持久化）
        val tempScript = createTempFile(suffix = ".js").apply {
            writeText(scriptContent)
            deleteOnExit()
        }

        // 6. 执行脚本并附带资源
        return scriptExecutionService.runScriptOnDevice(
            transportId = deviceId,
            scriptFile = tempScript,
            resources = listOf(tempFile)
        )
    }
}

private fun main() = runBlocking {
    val adbPath = ADBPATH // 你定义的 adb 路径
    val deviceId = "2"    // 你的设备 transportId，例如 1

    val adbService = AdbServiceImpl(adbPath)
    val cropper = DefaultImageCropper()
    val scriptExecutionService = ScriptExecutionServiceImpl()

    val useCase = RunAutoJsWithScreenshotUseCase(
        adbService = adbService,
        imageCropper = cropper,
        scriptGenerator = null,
        scriptExecutionService = scriptExecutionService
    )

    println("🚀 正在运行脚本...")

    val result = useCase.execute(deviceId)

//    if (result.success) {
//        println("✅ 脚本运行成功！日志如下：")
//        println(result.output)
//    } else {
//        println("❌ 脚本执行失败！")
//        println("错误信息: ${result.error}")
//    }
}