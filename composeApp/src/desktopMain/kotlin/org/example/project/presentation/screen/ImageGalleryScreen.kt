package org.example.project.presentation.screen

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import kotlinx.coroutines.launch
import org.example.project.domain.model.Rect
import org.example.project.domain.model.UserImageItem
import org.example.project.domain.repository.ImageRepositoryImpl
import org.example.project.domain.service.adb.AdbServiceImpl
import org.example.project.domain.service.image.DefaultImageCropper
import org.example.project.presentation.viewmodel.ImageManagerViewModel
import org.example.project.usecase.CaptureAndStoreImageUseCase
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import org.jetbrains.skia.Image

@Composable
fun ImageGalleryScreen(
    viewModel: ImageManagerViewModel,
    onCaptureImage: () -> Unit,
    onCropImage: (UserImageItem) -> Unit,
) {
    val imageList by viewModel.imageList.collectAsState()
    val scope = rememberCoroutineScope()
    var selectedImage by remember { mutableStateOf<UserImageItem?>(null) }
    var showDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Button(onClick = onCaptureImage) {
                Text("📸 截图")
            }
        }

        LazyVerticalGrid(
            columns = GridCells.Adaptive(128.dp),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(imageList, key = { it.name }) { imageItem ->
                ImageTile(
                    item = imageItem,
                    onClick = {},
                    onLongClick = {
                        selectedImage = imageItem
                        showDialog = true
                    }
                )
            }
        }
    }

    if (showDialog && selectedImage != null) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {},
            title = { Text("图片操作") },
            text = {
                Column {
                    Button(onClick = {
                        scope.launch {
                            viewModel.removeImage(selectedImage!!.name)
                            showDialog = false
                        }
                    }) { Text("🗑 删除") }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(onClick = {
                        showDialog = false
                        onCropImage(selectedImage!!)
                    }) { Text("✂ 截图") }
                }
            }
        )
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
        val imageRepository = ImageRepositoryImpl()
        val captureUseCase = CaptureAndStoreImageUseCase(AdbServiceImpl(), DefaultImageCropper(), imageRepository)
        val viewModel = ImageManagerViewModel(imageRepository)
        var scope= rememberCoroutineScope()

        ImageGalleryScreen(
            viewModel = viewModel,
            onCaptureImage = {
                scope.launch {
                     captureUseCase.execute(deviceId = "1", cropRegion = Rect(0, 0, 1080, 960))
                }
            },
            onCropImage = { item -> println("跳转裁剪页: ${item.name}") }
        )

    }
}