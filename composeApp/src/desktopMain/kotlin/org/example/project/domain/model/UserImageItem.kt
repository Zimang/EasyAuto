package org.example.project.domain.model

data class UserImageItem(
    val name: String,                  // 用户命名或系统自动命名
    val imagePath: String,            // 本地图片文件路径
    val matchedCount: Int = 0,        // 被脚本查图成功的次数
    val lastMatchedTime: Long? = null,// 最近一次查图成功时间
    val tags: List<String> = emptyList(), // 可选：分类标签
)
