package org.example.project.presentation.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepositoryImpl
import org.example.project.domain.service.adb.AdbServiceImpl
import org.example.project.domain.service.adb.ScriptExecutionServiceImpl
import org.example.project.domain.service.image.DefaultImageCropper
import org.example.project.presentation.viewmodel.DeviceSelectionViewModel
import org.example.project.presentation.viewmodel.ImageManagerViewModel
import org.example.project.usecase.CaptureAndStoreImageUseCase
import org.example.project.usecase.VerifyImageUseCase
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun DeviceSelectorScreen(
    selectedDeviceId: String?,
    devices: List<String>,
    onDeviceSelected: (String) -> Unit,
    onRefreshDevices: () -> Unit
) {
    Column(modifier = Modifier.fillMaxHeight().padding(16.dp)) {
        Text("设备选择", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(8.dp))

        if (devices.isEmpty()) {
            Text("未检测到设备")
        } else {
            devices.forEach { device ->
                Button(
                    onClick = { onDeviceSelected(device) },
                    modifier = Modifier.padding(vertical = 4.dp),
                    colors = if (device == selectedDeviceId)
                        ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    else ButtonDefaults.buttonColors()
                ) {
                    Text(device)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        OutlinedButton(onClick = onRefreshDevices) {
            Text("刷新设备")
        }
    }
}


@Composable
fun DeviceAndGalleryScreen(
    deviceViewModel: DeviceSelectionViewModel = DeviceSelectionViewModel(),
) {
    val imageRepository = remember { ImageRepositoryImpl() }

    val captureUseCase = remember {
        CaptureAndStoreImageUseCase(AdbServiceImpl(), DefaultImageCropper(), imageRepository)
    }

    val verifyImageUseCase = remember {
        VerifyImageUseCase(AdbServiceImpl(), ScriptExecutionServiceImpl())
    }

    val viewModel = remember { ImageManagerViewModel(imageRepository) }
    val cropTarget = remember { mutableStateOf<UserImageItem?>(null) }
    val scope = rememberCoroutineScope()

    val selectedDeviceId = remember { deviceViewModel.selectedDevice } 

    Row(modifier = Modifier.fillMaxSize()) {
        DeviceSelectorScreen(
            selectedDeviceId = selectedDeviceId.value,
            devices = deviceViewModel.devices,
            onDeviceSelected = { deviceViewModel.selectDevice(it) },
            onRefreshDevices = { deviceViewModel.refreshDevices() }
        )

        Spacer(modifier = Modifier.width(16.dp))

        Box(modifier = Modifier.weight(1f)) {
            if (selectedDeviceId.value.isNullOrEmpty()) {
                Box(modifier = Modifier.fillMaxSize()
//                    .background(color = Color.Red)
                    , contentAlignment = Alignment.Center) {
                    Text("请先选择设备")
                }
            } else {
                ImageGalleryScreen(
                    viewModel = viewModel,
                    deviceId = selectedDeviceId.value!!,
                    onRequestCaptureScreen = {
                        scope.launch {
                            val userImageItem = captureUseCase.execute(selectedDeviceId.value!!, null)
                            println(userImageItem)
                        }
                    },
                    onRequestVerify = {
                        scope.launch {
                            verifyImageUseCase.execute(selectedDeviceId.value!!, it)
                        }
                    },
                    onRequestVerifyLandScape = {
                        scope.launch {
                            verifyImageUseCase.execute(selectedDeviceId.value!!, it,true)
                        }
                    },
                    onRequestCrop = { item -> cropTarget.value = item }
                )
            }
        }
    }
    cropTarget.value?.let { image ->
        Window(
            onCloseRequest = { cropTarget.value = null },
            title = "裁剪图片 - ${image.name}",
            state = rememberWindowState(width = 1200.dp, height = 1000.dp)
        ) {
            ImageCropScreen(
                image = image,
                onCancel = { cropTarget.value = null },
                onConfirmCrop = { rect ->
                    viewModel.cropImage(image, rect)
                    cropTarget.value = null
                }
            )
        }
    }

}

@Composable
fun DeviceSelectorScreen_(
) {
    DeviceSelectorScreen(
        selectedDeviceId = null,
        devices = listOf(),
        onDeviceSelected = {},
        onRefreshDevices = {},
    )
}
private fun main()= application {
    Window(onCloseRequest = ::exitApplication, title = "设备选择") {
        DeviceAndGalleryScreen()
    }
}
