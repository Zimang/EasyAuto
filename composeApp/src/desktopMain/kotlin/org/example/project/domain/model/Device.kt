package org.example.project.domain.model

data class Device(
    val name: String,         // 如 emulator-5554
    val transportId: String,  // 如 2（强烈推荐用它做唯一 key）
    val serial: String,       // 设备序列号
    val model: String?,       // 设备模型，如 Pixel_5
    val product: String?,     // 产品型号
    val device: String?       // 设备名
)