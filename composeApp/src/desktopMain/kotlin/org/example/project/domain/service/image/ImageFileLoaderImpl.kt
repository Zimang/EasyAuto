package org.example.project.domain.service.image

import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

class ImageFileLoaderImpl : ImageFileLoader {
    override suspend fun load(file: File): BufferedImage {
        return ImageIO.read(file)
            ?: throw IllegalArgumentException("无法读取图片文件: ${file.absolutePath}")
    }
}