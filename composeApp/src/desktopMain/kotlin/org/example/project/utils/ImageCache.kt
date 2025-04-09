package org.example.project.utils

import java.awt.image.BufferedImage
import java.io.File
import java.lang.ref.SoftReference
import javax.imageio.ImageIO

object ImageCache {
    private val cache = mutableMapOf<String, SoftReference<BufferedImage>>()

    fun get(path: String): BufferedImage? {
        return cache[path]?.get() ?: loadAndCache(path)
    }

    fun invalidate(path: String) {
        cache.remove(path)
    }

    private fun loadAndCache(path: String): BufferedImage? {
        return try {
            val image = ImageIO.read(File(path))
            if (image != null) {
                cache[path] = SoftReference(image)
            }
            image
        } catch (e: Exception) {
            println("图片加载失败: $path, 原因: \${e.message}")
            null
        }
    }
}
