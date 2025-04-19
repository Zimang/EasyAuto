package org.example.project

import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import org.example.project.presentation.screen.DeviceAndGalleryScreen
import org.example.project.presentation.screen.DeviceSelectorScreen
import org.example.project.presentation.screen.TestImageGallrayScreen
import java.awt.Window

fun main() = application {
    Window(
        onCloseRequest = ::exitApplication,
        title = "EasyAutoJS",
        alwaysOnTop = true,
    ) {
        DeviceAndGalleryScreen()
    }
}