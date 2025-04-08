package org.example.project.domain.service

import org.example.project.domain.model.Device

interface DeviceService {
    suspend fun getConnectedDevices(): List<Device>
}