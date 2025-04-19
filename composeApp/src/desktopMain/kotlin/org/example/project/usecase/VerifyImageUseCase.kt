package org.example.project.usecase

import org.example.project.domain.model.ScriptExecutionResult
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.service.PlaceholderScriptGenerator
import org.example.project.domain.service.adb.AdbService
import org.example.project.domain.service.adb.ScriptExecutionService
import java.io.File

class VerifyImageUseCase(
    private val adbService: AdbService,
//    private val scriptGenerator: PlaceholderScriptGenerator,
    private val scriptExecutionService: ScriptExecutionService,
) {
    suspend fun execute(deviceId: String, image: UserImageItem,isLandScape:Boolean=false): ScriptExecutionResult {
        val file = File(image.imagePath)
        val remotePath = "/sdcard/autojs_test/${file.name}"
        adbService.pushFile(deviceId, file, remotePath)

//        val scriptContent = scriptGenerator.copy(
//            placeholders = mapOf("imageName" to file.name)
//        ).generateScript()
        val scriptContent = PlaceholderScriptGenerator(
            placeholders = mapOf(
                "imageName" to file.name,
                "isLandScape" to isLandScape.toString(),
            )
        ).generateScript()

        val tempScript = File.createTempFile("verify_", ".js").apply {
            writeText(scriptContent)
            println("Successfully created temporary file")
            deleteOnExit()
        }

        return scriptExecutionService.runScriptOnDevice(
            transportId = deviceId,
            scriptFile = tempScript,
            resources = listOf(file)
        )
    }
}
