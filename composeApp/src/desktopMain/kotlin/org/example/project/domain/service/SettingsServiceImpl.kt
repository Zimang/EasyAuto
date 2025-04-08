package org.example.project.domain.service

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

class SettingsServiceImpl(
    private val settingsFile: File = File(System.getProperty("user.home"), ".easyautojs/settings.json"),
    private val gson: Gson = Gson()
) : SettingsService {

    private val lock = Any()
    private var cache: MutableMap<String, String> = mutableMapOf()

    init {
        if (settingsFile.exists()) {
            runCatching {
                val type = object : TypeToken<MutableMap<String, String>>() {}.type
                cache = gson.fromJson(settingsFile.readText(), type)
            }
        }
    }

    override suspend fun getAdbPath(): String {
        return cache["adbPath"] ?: defaultAdbPath()
    }

    override suspend fun setAdbPath(path: String) {
        cache["adbPath"] = path
        persist()
    }

    override suspend fun getTemplateDir(): File {
        val path = cache["templateDir"]
            ?: File(System.getProperty("user.home"), "Pictures/templates").absolutePath
        return File(path)
    }

    override suspend fun setTemplateDir(path: File) {
        cache["templateDir"] = path.absolutePath
        persist()
    }

    private fun persist() {
        synchronized(lock) {
            val json = gson.toJson(cache)
            settingsFile.parentFile.mkdirs()
            settingsFile.writeText(json)
        }
    }

    private fun defaultAdbPath(): String {
        return if (System.getProperty("os.name").startsWith("Windows")) {
            "adb.exe"
        } else {
            "/usr/bin/adb"
        }
    }
}