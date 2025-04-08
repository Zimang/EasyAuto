package org.example.project.domain.service

import java.awt.image.BufferedImage
import java.io.File

interface ImageFileLoader {
    suspend fun load(file: File): BufferedImage
}