package org.example.project.domain.repository

import org.example.project.domain.model.ScreenshotSource
import java.awt.image.BufferedImage

interface ScreenshotRepository {
    suspend fun getScreenshot(source: ScreenshotSource): BufferedImage
}