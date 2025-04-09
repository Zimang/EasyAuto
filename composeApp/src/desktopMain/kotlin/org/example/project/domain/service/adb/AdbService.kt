package org.example.project.domain.service.adb

import java.awt.image.BufferedImage
import java.io.File

interface AdbService {
    suspend fun captureScreenshot(deviceId: String): BufferedImage
    suspend fun pushFile(deviceId: String, localFile: File, remotePath: String): Result<Unit>
    suspend fun pushFile(deviceId: String, localFile: BufferedImage, remotePath: String): Result<Unit>

}