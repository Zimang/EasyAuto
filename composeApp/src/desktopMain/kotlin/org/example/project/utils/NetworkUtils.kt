package org.example.project.utils

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

// 这里是一个最小的本地 HTTP 控制服务，可以在 KMP (desktopMain) 启动
fun startLocalControlServer(port: Int = 8899) {
    var controlCommand = "none"

    embeddedServer(Netty, port = port) {
        routing {
            // 用于设置控制命令
            get("/set") {
                val cmd = call.request.queryParameters["cmd"] ?: "none"
                controlCommand = cmd
                call.respondText("Command set to: $controlCommand", ContentType.Text.Plain)
            }

            // Auto.js 定时轮询这个接口获取命令
            get("/control") {
                call.respondText(controlCommand, ContentType.Text.Plain)
            }
        }
    }.start(wait = false)
}
