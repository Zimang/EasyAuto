package org.example.project.presentation.screen

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.example.project.domain.model.Rect
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepositoryImpl
import org.example.project.domain.service.adb.AdbServiceImpl
import org.example.project.domain.service.adb.ScriptExecutionServiceImpl
import org.example.project.domain.service.image.DefaultImageCropper
import org.example.project.domain.service.log.ScriptLogServiceImpl
import org.example.project.presentation.viewmodel.ImageManagerViewModel
import org.example.project.usecase.CaptureAndStoreImageUseCase
import org.example.project.usecase.VerifyImageUseCase
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import org.jetbrains.skia.Image
import org.jetbrains.skiko.toBitmap


@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ImageGalleryScreen(
    viewModel: ImageManagerViewModel,
    onRequestCrop: (UserImageItem) -> Unit,
    onRequestVerify: (UserImageItem) -> Unit,
    onRequestCaptureScreen: () -> Job,
) {
    val imageList by viewModel.imageList.collectAsState()
    val scope = rememberCoroutineScope()

    var selectedImage by remember { mutableStateOf<UserImageItem?>(null) }
    var showMenuForImage by remember { mutableStateOf<UserImageItem?>(null) }
//    var cropTarget by remember { mutableStateOf<UserImageItem?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(128.dp),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(imageList, key = { it.name }) { image ->
                val bitmap = remember(image.imagePath) {
                    runCatching {
                        ImageIO.read(File(image.imagePath)).toBitmap().asImageBitmap()
                    }.getOrNull()
                }

                Box(modifier = Modifier
                    .aspectRatio(1f)
                    .fillMaxWidth()
                    .combinedClickable(
                        onClick = {},
                        onLongClick = { showMenuForImage = image }
                    )
                ) {
                    bitmap?.let {
                        Image(bitmap = it, contentDescription = image.name, modifier = Modifier.fillMaxSize())
                    }
                }
            }
        }

        FloatingActionButton(
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            onClick = { onRequestCaptureScreen() }
        ) {
            Text("📷")
        }

        DropdownMenu(
            expanded = showMenuForImage != null,
            onDismissRequest = { showMenuForImage = null }
        ) {
            DropdownMenuItem(
                text = { Text("截图裁剪") },
                onClick = {
//                    showMenuForImage?.let {
//                        cropTarget = it
//                        showMenuForImage = null
//                    }
                    showMenuForImage?.let {
                        onRequestCrop(it) // 触发外部弹窗逻辑
                        showMenuForImage = null
                    }
                }
            )
            DropdownMenuItem(
                text = { Text("发送验证") },
                onClick = {
                    showMenuForImage?.let(onRequestVerify)
                    showMenuForImage = null
                }
            )
            DropdownMenuItem(
                text = { Text("删除") },
                onClick = {
                    showMenuForImage?.let { viewModel.removeImage(it.name) }
                    showMenuForImage = null
                }
            )
        }

    }
}


fun BufferedImage.toImageBitmap(): ImageBitmap {
    val outputStream = java.io.ByteArrayOutputStream()
    javax.imageio.ImageIO.write(this, "png", outputStream)
    val bytes = outputStream.toByteArray()
    val skiaImage = Image.makeFromEncoded(bytes)
    return skiaImage.toComposeImageBitmap()
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ImageTile(
    item: UserImageItem,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    val imageBitmap = remember(item.imagePath) {
        runCatching {
            ImageIO.read(File(item.imagePath))?.toImageBitmap()
        }.getOrNull()
    }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        contentAlignment = Alignment.Center
    ) {
        if (imageBitmap != null) {
            Image(bitmap = imageBitmap, contentDescription = null)
        } else {
            Text("❌ 读取失败")
        }
    }
}

private fun main() = application {
    Window(onCloseRequest = ::exitApplication, title = "Image Gallery") {
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

        ImageGalleryScreen(
            viewModel = viewModel,
            onRequestCaptureScreen = {
                scope.launch {
                    val userImageItem=captureUseCase.execute("1", null)
                    println(userImageItem)
                }
            },
            onRequestVerify = {
                scope.launch {
                    verifyImageUseCase.execute("1",it)
                 }
            },
            onRequestCrop = {  item -> cropTarget.value = item }
        )

        // 🚪 单独裁剪窗口
        cropTarget.value?.let { image ->
            Window(
                onCloseRequest = { cropTarget.value = null },
                title = "裁剪图片 - ${image.name}",
                state = rememberWindowState(width = 600.dp, height = 600.dp)
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
}