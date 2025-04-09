package org.example.project.domain.service

import kotlinx.coroutines.runBlocking
import java.net.URLClassLoader
import java.nio.file.Paths
import kotlin.io.path.readText

fun listAllResources() {
    val loader = PlaceholderScriptGenerator::class.java.classLoader
    loader.getResources("").toList().forEach {
        println("resource: $it")
    }
}


class PlaceholderScriptGenerator(
    private val templateName: String = "templates/temp_demo.js",
    private val placeholders: Map<String, String>
) {
    fun generateScript(): String {
//        val resource = this::class.java.classLoader.getResource(templateName)
//            ?: error("模板文件不存在: $templateName")
//        val content = resource.readText()
//        return replacePlaceholders(content)

        val templatePath = "templates/temp_demo.js"
        val resource = this::class.java.classLoader.getResource(templatePath)

        println("resource loaded: $resource") // 会打印出 null 或完整路径

        if (resource == null) {
            println("资源路径读取失败，当前 classLoader 是：")
            println(this::class.java.classLoader)

            val rootPaths = this::class.java.classLoader.let { it as? URLClassLoader }?.urLs?.joinToString("\n") ?: "无法解析 URLClassLoader"
            println("当前 classLoader 可见路径：\n$rootPaths")
        }


        val inputStream = this::class.java.classLoader.getResourceAsStream(templateName)
            ?: error("模板文件不存在: $templateName")
        val content = inputStream.bufferedReader().readText()
        return replacePlaceholders(content)
    }

    private fun replacePlaceholders(template: String): String {
        var result = template
        for ((key, value) in placeholders) {
            result = result.replace("\${$key}", value)
        }
        return result
    }
}

private fun main() = runBlocking {
    listAllResources()
    val generator = PlaceholderScriptGenerator(
        templateName = "templates/temp_demo.js",
        placeholders = mapOf("imageName" to "cut_1_1.png")
    )
    val script = generator.generateScript()
    println("生成脚本内容：\n$script")
}