package org.example.project.domain.service.image

import kotlinx.coroutines.runBlocking
import org.example.project.domain.model.Rect
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

class DefaultImageCropper : ImageCropper {
    override fun crop(image: BufferedImage, rect: Rect?): BufferedImage {
        if (rect == null) {
            return image
        }
        return image.getSubimage(
            rect.x.coerceIn(0, image.width),
            rect.y.coerceIn(0, image.height),
            rect.width.coerceAtMost(image.width - rect.x),
            rect.height.coerceAtMost(image.height - rect.y)
        )
    }
}

//private fun main(): Unit =runBlocking {
//    val image = ImageIO.read(File("D:\\workplace\\proj\\KotlinProject\\composeApp\\screenshot_test.png"))
//    val cropper = DefaultImageCropper()
//    val cropped = cropper.crop(image, Rect(100, 100, 200, 200))
//    ImageIO.write(cropped, "png", File("cropped_result.png"))
//}