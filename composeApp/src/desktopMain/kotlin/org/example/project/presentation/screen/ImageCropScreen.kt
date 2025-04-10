package org.example.project.presentation.screen

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import org.example.project.domain.model.Rect
import org.example.project.domain.model.UserImageItem
import java.io.File
import javax.imageio.ImageIO


@Composable
fun ImageCropScreen(
    image: UserImageItem,
    onCancel: () -> Unit,
    onConfirmCrop: (Rect) -> Unit
) {
    val imageBitmap = remember(image.imagePath) {
        runCatching {
            ImageIO.read(File(image.imagePath))?.toImageBitmap()
        }.getOrNull()
    }

    var startOffset by remember { mutableStateOf<Offset?>(null) }
    var endOffset by remember { mutableStateOf<Offset?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .aspectRatio(1f)
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = {
                            startOffset = it
                            endOffset = it
                        },
                        onDrag = { change, _ ->
                            endOffset = change.position
                        }
                    )
                }
                .border(1.dp, Color.Gray)
        ) {
            if (imageBitmap != null) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawImage(imageBitmap)

                    val rectStart = startOffset
                    val rectEnd = endOffset
                    if (rectStart != null && rectEnd != null) {
                        val left = minOf(rectStart.x, rectEnd.x)
                        val top = minOf(rectStart.y, rectEnd.y)
                        val right = maxOf(rectStart.x, rectEnd.x)
                        val bottom = maxOf(rectStart.y, rectEnd.y)

                        // 暗化整个画布
                        drawRect(Color(0xAA000000))

                        // 清除裁剪区域的暗化
                        drawIntoCanvas { canvas ->
                            withTransform({
                                clipRect(left, top, right, bottom)
                            }) {
                                drawRect(Color.Transparent)
                            }
                        }

                        // 绘制边框
                        drawRect(
                            color = Color.Red,
                            topLeft = Offset(left, top),
                            size = androidx.compose.ui.geometry.Size(right - left, bottom - top),
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f)
                        )
                    }
                }
            }
        }

        Row(
            horizontalArrangement = Arrangement.SpaceEvenly,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        ) {
            Button(onClick = onCancel) {
                Text("取消")
            }
            Button(
                onClick = {
                    val rect = Rect(
                        x = minOf(startOffset!!.x, endOffset!!.x).toInt(),
                        y = minOf(startOffset!!.y, endOffset!!.y).toInt(),
                        width = kotlin.math.abs(startOffset!!.x - endOffset!!.x).toInt(),
                        height = kotlin.math.abs(startOffset!!.y - endOffset!!.y).toInt()
                    )
                    onConfirmCrop(rect)
                },
                enabled = startOffset != null && endOffset != null
            ) {
                Text("保存截图")
            }
        }
    }
}



@Composable
fun TestCropScreen() {
    val image = remember {
        UserImageItem(
            name = "cropped_result",
            imagePath = "D:/workplace/proj/KotlinProject/composeApp/cropped_result.png"
        )
    }

    ImageCropScreen(
        image = image,
        onCancel = { println("❌ 取消裁剪") },
        onConfirmCrop = { rect ->
            println("✅ 用户选择的裁剪区域: $rect")
        }
    )
}

private  fun main() = application {
    Window(onCloseRequest = ::exitApplication) {
        MaterialTheme {
            TestCropScreen()
        }
    }
}

