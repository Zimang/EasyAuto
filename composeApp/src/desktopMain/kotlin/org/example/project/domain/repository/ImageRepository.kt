package org.example.project.domain.repository

import kotlinx.coroutines.flow.Flow
import org.example.project.domain.model.UserImageItem

interface ImageRepository {
    val allImages: Flow<List<UserImageItem>>

    suspend fun addImage(item: UserImageItem)
    suspend fun removeImage(name: String)
    suspend fun removeAllImage()
}
