package org.example.project.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.example.project.domain.model.Rect
import org.example.project.domain.model.ScreenshotSource
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepository
import org.example.project.domain.repository.ScreenshotRepository
import org.example.project.domain.repository.ScreenshotRepositoryImpl
import org.example.project.usecase.CaptureAndStoreImageUseCase
import java.io.File
import javax.imageio.ImageIO

class ImageManagerViewModel(
    private val imageRepository: ImageRepository,
    private val screenshotRepository: ScreenshotRepository=ScreenshotRepositoryImpl(),
) : ViewModel() {
    val imageList: StateFlow<List<UserImageItem>> = imageRepository.allImages.stateIn(
        viewModelScope,
//        SharingStarted.Lazily, //这部分代码可能会导致数据不会更新
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    fun addImage(item: UserImageItem) {
        viewModelScope.launch {
            imageRepository.addImage(item)
        }
    }

    fun removeImage(name: String) {
        viewModelScope.launch {
            imageRepository.removeImage(name)
        }
    }
    fun cropImage(source: UserImageItem, rect: Rect) {
        viewModelScope.launch {
            val original = ImageIO.read(File(source.imagePath))
            val cropped = original.getSubimage(rect.x, rect.y, rect.width, rect.height)

            val fileName = "crop_${System.currentTimeMillis()}.png"
            val outputFile = File(fileName)
            ImageIO.write(cropped, "png", outputFile)

            val newItem = UserImageItem(
                name = fileName,
                imagePath = outputFile.absolutePath,
            )
            imageRepository.addImage(newItem)
        }
    }

}
