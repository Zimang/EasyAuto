package org.example.project.domain.service.image

import java.awt.image.BufferedImage
import java.io.File

interface ImageFileLoader {
    suspend fun load(file: File): BufferedImage
}