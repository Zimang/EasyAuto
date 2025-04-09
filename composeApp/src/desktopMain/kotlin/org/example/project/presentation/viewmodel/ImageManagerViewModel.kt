package org.example.project.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepository

class ImageManagerViewModel(
    private val imageRepository: ImageRepository
) : ViewModel() {
    val imageList: StateFlow<List<UserImageItem>> = imageRepository.allImages.stateIn(
        viewModelScope,
        SharingStarted.Lazily,
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
}
