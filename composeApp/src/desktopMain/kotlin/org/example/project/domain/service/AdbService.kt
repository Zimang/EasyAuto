package org.example.project.domain.service

import java.awt.image.BufferedImage

interface AdbService {
    suspend fun captureScreenshot(deviceId: String): BufferedImage
}