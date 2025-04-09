package org.example.project.domain.service.adb

import org.example.project.domain.model.Device

interface DeviceService {
    suspend fun getConnectedDevices(): List<Device>
}