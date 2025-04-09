package org.example.project.domain.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import org.example.project.domain.model.UserImageItem

class ImageRepositoryImpl : ImageRepository {
    private val images = MutableStateFlow<List<UserImageItem>>(emptyList())

    override val allImages: Flow<List<UserImageItem>> = images

    override suspend fun addImage(item: UserImageItem) {
        images.update { it + item }
    }

    override suspend fun removeImage(name: String) {
        images.update { it.filterNot { it.name == name } }
    }
}
