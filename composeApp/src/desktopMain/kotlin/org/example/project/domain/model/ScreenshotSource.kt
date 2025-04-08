package org.example.project.domain.model

import java.io.File

sealed interface ScreenshotSource {
    data class FromDevice(val transportId: String) : ScreenshotSource
    data class FromFile(val file: File) : ScreenshotSource
}