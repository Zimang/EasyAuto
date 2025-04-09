package org.example.project.domain.repository

import org.example.project.domain.model.ScreenshotSource
import org.example.project.domain.service.adb.AdbService
import org.example.project.domain.service.image.ImageFileLoader
import java.awt.image.BufferedImage

class ScreenshotRepositoryImpl(
    private val adbService: AdbService,
    private val fileLoader: ImageFileLoader
) : ScreenshotRepository {

    override suspend fun getScreenshot(source: ScreenshotSource): BufferedImage {
        return when (source) {
            is ScreenshotSource.FromDevice -> adbService.captureScreenshot(source.transportId)
            is ScreenshotSource.FromFile -> fileLoader.load(source.file)
        }
    }
}
