package org.example.project.domain.service

import kotlinx.coroutines.runBlocking
import org.example.project.domain.model.Device

class DeviceServiceImpl(
    private val adbPath: String
) : DeviceService {

    override suspend fun getConnectedDevices(): List<Device> {
        val process = ProcessBuilder(adbPath, "devices", "-l")
            .redirectErrorStream(true)
            .start()

        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()

        return parseAdbDevicesOutput(output)
    }

    private fun parseAdbDevicesOutput(output: String): List<Device> {
        return output.lineSequence()
            .drop(1) // 第一行是 "List of devices attached"
            .filter { it.isNotBlank() && it.contains("device") }
            .mapNotNull { line ->
                val serialRegex = """^(\S+)\s+device""".toRegex()
                val transportRegex = """transport_id:(\d+)""".toRegex()
                val modelRegex = """model:(\S+)""".toRegex()
                val productRegex = """product:(\S+)""".toRegex()
                val deviceRegex = """device:(\S+)""".toRegex()

                val serial = serialRegex.find(line)?.groupValues?.get(1) ?: return@mapNotNull null
                val transportId = transportRegex.find(line)?.groupValues?.get(1) ?: "0"

                Device(
                    name = serial,
                    serial = serial,
                    transportId = transportId,
                    model = modelRegex.find(line)?.groupValues?.get(1),
                    product = productRegex.find(line)?.groupValues?.get(1),
                    device = deviceRegex.find(line)?.groupValues?.get(1)
                )
            }
            .toList()
    }
}

private fun  main() = runBlocking {
    val service = DeviceServiceImpl(ADBPATH)
    val devices = service.getConnectedDevices()
    devices.forEach {
        println("${it.name} [t=${it.transportId}] model=${it.model}")
    }

}