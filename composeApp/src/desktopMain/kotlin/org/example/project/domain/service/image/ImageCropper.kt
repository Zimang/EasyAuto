package org.example.project.domain.service.image

import org.example.project.domain.model.Rect
import java.awt.image.BufferedImage

interface ImageCropper {
    fun crop(image: BufferedImage, rect: Rect?): BufferedImage
}