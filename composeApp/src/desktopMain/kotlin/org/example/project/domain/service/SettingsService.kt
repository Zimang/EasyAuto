package org.example.project.domain.service

import java.io.File

interface SettingsService {
    suspend fun getAdbPath(): String
    suspend fun setAdbPath(path: String)

    suspend fun getTemplateDir(): File
    suspend fun setTemplateDir(path: File)
}