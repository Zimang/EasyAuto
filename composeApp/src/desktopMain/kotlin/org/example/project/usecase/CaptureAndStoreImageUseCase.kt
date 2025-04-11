package org.example.project.usecase

import org.example.project.domain.model.Rect
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepository
import org.example.project.domain.service.adb.AdbService
import org.example.project.domain.service.image.ImageCropper
import java.io.File
import javax.imageio.ImageIO

class CaptureAndStoreImageUseCase(
    private val adbService: AdbService,
    private val imageCropper: ImageCropper,
    private val imageRepository: ImageRepository,
) {
    suspend fun execute(deviceId: String, cropRegion: Rect?): UserImageItem {
        val screenshot = adbService.captureScreenshot(deviceId)
        val cropped = imageCropper.crop(screenshot, cropRegion)

        val fileName = "img_${System.currentTimeMillis()}.png"
//        val file = File("your/save/path/$fileName") // TODO: 项目级统一图片目录
        val file = File(fileName) // 当前文件夹 desktopMain
        ImageIO.write(cropped, "png", file)

        val item = UserImageItem(
            name = fileName,
            imagePath = file.absolutePath,
        )
        imageRepository.addImage(item)
        return item
    }
}
