package org.example.project.domain.service.settings

import java.io.File

interface SettingsService {
    suspend fun getAdbPath(): String
    suspend fun setAdbPath(path: String)

    suspend fun getTemplateDir(): File
    suspend fun setTemplateDir(path: File)
}