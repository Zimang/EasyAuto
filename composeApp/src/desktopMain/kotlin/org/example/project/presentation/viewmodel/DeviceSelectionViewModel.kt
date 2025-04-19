package org.example.project.presentation.viewmodel

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader

class DeviceSelectionViewModel : ViewModel() {
    val devices = mutableStateListOf<String>()
    val selectedDevice = mutableStateOf<String?>(null)

    fun refreshDevices() {
        CoroutineScope(Dispatchers.IO).launch {
            val result = mutableListOf<String>()
            try {
                val process = ProcessBuilder("adb", "devices").start()
                val reader = BufferedReader(InputStreamReader(process.inputStream))
                reader.readLine() // skip header
                reader.lineSequence().forEach {
                    val parts = it.split("\t")
                    if (parts.size == 2 && parts[1] == "device") {
                        result.add(parts[0])
                    }
                }
                devices.clear()
                devices.addAll(result)
            } catch (e: Exception) {
                println("ADB 设备获取失败: ${e.message}")
            }
        }
    }

    fun selectDevice(deviceId: String) {
        selectedDevice.value = deviceId
    }
}
