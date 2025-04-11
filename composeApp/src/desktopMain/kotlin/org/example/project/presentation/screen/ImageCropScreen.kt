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
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.isTertiaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
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
    } ?: return

    var scale by remember { mutableStateOf(1f) }
    val offsetState = rememberSaveable(stateSaver = OffsetSaver) { mutableStateOf(Offset.Zero) }
    var offset by offsetState


    var startOffset by remember { mutableStateOf<Offset?>(null) }
    var endOffset by remember { mutableStateOf<Offset?>(null) }

    var mode by remember { mutableStateOf("SELECT") } // SELECT or DRAG

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {

        Box(
            modifier = Modifier
                .weight(1f)
                .aspectRatio(1f)
                .pointerInput(mode) {
                    detectDragGestures( // unified handler with internal mode check
                        onDragStart = {
                            if (mode == "SELECT") {
                                val cropTopLeft = Offset(0f, 0f)
                                val cropBoxSize = size
                                println("[onDragStart] SELECT triggered at: $it")
                                startOffset = it.coerceInRect(cropTopLeft, cropBoxSize.toSize())
                                endOffset = startOffset
                            } else {
                                println("[onDragStart] DRAG mode")
                            }
                        },
                        onDragEnd = {
                            if (mode == "SELECT") {
                                println("[onDragEnd] SELECT completed: start=$startOffset, end=$endOffset")
                            } else {
                                println("[onDragEnd] DRAG completed, final offset = $offset")
                            }
                        },
                        onDragCancel = {
                            println("[onDragCancel] gesture cancelled")
                        },
                        onDrag = { change, dragAmount ->
                            if (mode == "SELECT") {
                                val cropTopLeft = Offset(0f, 0f)
                                val cropBoxSize = size
                                val newEnd = change.position.coerceInRect(cropTopLeft, cropBoxSize.toSize())
                                if (startOffset == null) {
                                    println("[onDrag] inferred start = ${newEnd - dragAmount}")
                                }
                                println("[onDrag] SELECT dragging: dragAmount = $dragAmount, current = ${change.position}")
                                startOffset = startOffset ?: (newEnd - dragAmount)
                                endOffset = newEnd
                            } else {
                                println("[onDrag] DRAG dragging: delta = $dragAmount scale $scale")
                                println("[onDrag] DRAG dragging: offsets from = $offset")
//                                offset += dragAmount
                                // 修正拖动图像时 offset 增量
                                offset += dragAmount /scale
                                println("[onDrag] DRAG dragging: offsets to = $offset")
                            }
                            change.consume()
                        }
                    )}
                .border(1.dp, Color.Gray)
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                withTransform({
                    scale(scale,scale)
                    translate(offset.x, offset.y)
                }) {
                    drawImage(imageBitmap)
                }

                val rectStart = startOffset
                val rectEnd = endOffset
                if (rectStart != null && rectEnd != null) {
                    val left = minOf(rectStart.x, rectEnd.x)
                    val top = minOf(rectStart.y, rectEnd.y)
                    val right = maxOf(rectStart.x, rectEnd.x)
                    val bottom = maxOf(rectStart.y, rectEnd.y)

                    drawIntoCanvas { canvas ->
                        val paint = Paint().apply { color = Color(0xAA000000) }
                        canvas.save()
                        canvas.clipRect(Offset(left, top).toAndroidRect(Size(right - left, bottom - top)).toAndroidRect(), ClipOp.Difference)
                        canvas.drawRect(0f, 0f, size.width, size.height, paint)
                        canvas.restore()
                    }

                    drawRect(
                        color = Color.Red,
                        topLeft = Offset(left, top),
                        size = Size(right - left, bottom - top),
                        style = Stroke(
                            width = 2f,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f))
                        )
                    )
                }
            }
        }

        Row(
            horizontalArrangement = Arrangement.SpaceEvenly,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        ) {
            Button(onClick = onCancel) { Text("取消") }
            Button(
                enabled = startOffset != null && endOffset != null,
                onClick = {
                    val start = startOffset!!
                    val end = endOffset!!
                    val cropLeft = minOf(start.x, end.x)
                    val cropTop = minOf(start.y, end.y)
                    val cropRight = maxOf(start.x, end.x)
                    val cropBottom = maxOf(start.y, end.y)

                    val imageX = ((cropLeft - offset.x) / scale).toInt()
                    val imageY = ((cropTop - offset.y) / scale).toInt()
                    val imageW = ((cropRight - cropLeft) / scale).toInt()
                    val imageH = ((cropBottom - cropTop) / scale).toInt()

                    val rect = Rect(
                        x = imageX.coerceAtLeast(0),
                        y = imageY.coerceAtLeast(0),
                        width = imageW.coerceAtLeast(1),
                        height = imageH.coerceAtLeast(1)
                    )
                    onConfirmCrop(rect)
                }
            ) {
                Text("保存截图")
            }
        }

        Row(
            horizontalArrangement = Arrangement.SpaceEvenly,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
        ) {
            Button(onClick = { scale *= 1.25f }) { Text("放大") }
            Button(onClick = { scale *= 0.8f }) { Text("缩小") }
            Button(onClick = {
                mode = if (mode == "SELECT") "DRAG" else "SELECT"
            }) {
                Text(if (mode == "SELECT") "切换为拖动图像" else "切换为框选截图")
            }
        }
    }
}

// 限制点落在矩形内
private fun Offset.coerceInRect(topLeft: Offset, size: Size): Offset {
    val right = topLeft.x + size.width
    val bottom = topLeft.y + size.height
    return Offset(
        x = x.coerceIn(topLeft.x, right),
        y = y.coerceIn(topLeft.y, bottom)
    )
}

private fun Offset.toAndroidRect(size: Size): Rect {
    return Rect(
        x.toInt(),
        y.toInt(),
        (x + size.width).toInt(),
        (y + size.height).toInt()
    )
}
val OffsetSaver = Saver<Offset, List<Float>>(
    save = { listOf(it.x, it.y) },
    restore = { Offset(it[0], it[1]) }
)

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

