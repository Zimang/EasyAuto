package org.example.project.presentation.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow

// Define data class to store each draggable item's state
data class DraggableItemData(var x: Float, var y: Float, val name: String)

@Composable
fun WhiteboardDemo() {
    // shadowPic state for holding the dragging position
    var shadowPic = remember { mutableStateOf<Pair<Float, Float>?>(null) }
    // List to store placed items' positions
    var itemsList = remember { mutableStateOf<MutableList<DraggableItemData>>(mutableListOf()) }

    Row(modifier = Modifier.fillMaxSize()) {
        // Whiteboard
        Box(
            modifier = Modifier
                .fillMaxSize()
                .weight(1f)
                .background(Color.LightGray)
                .pointerInput(Unit) {
                    detectDragGestures { change, dragAmount ->
                        // Update shadowPic position during drag
                        shadowPic.value = shadowPic.value?.let {
                            Pair(it.first + dragAmount.x, it.second + dragAmount.y)
                        }
                    }
                }
        ) {
            // Render shadowPic with reduced opacity while dragging
            shadowPic.value?.let {
                Box(
                    modifier = Modifier
                        .offset(x = it.first.dp, y = it.second.dp)
                        .size(100.dp)
                        .background(Color.Blue.copy(alpha = 0.5f))  // Lower opacity for shadow effect
                )
            }

            // Render placed items from the itemsList
            itemsList.value.forEach { item ->
                DraggableItem(name = item.name, x = item.x, y = item.y)
            }
        }

        // Object List on the Right
        Column(
            modifier = Modifier
                .width(200.dp)
                .background(Color.Gray)
                .padding(10.dp)
        ) {
            DraggableBehavior("Square", shadowPic, { name, x, y ->
                // Add new item to the list when drag ends
                itemsList.value.add(DraggableItemData(x, y, name))
                println("itemsList: ${itemsList.value.size}")
            })
            DraggableBehavior("Rectangle", shadowPic, { name, x, y ->
                // Add new item to the list when drag ends
                itemsList.value.add(DraggableItemData(x, y, name))
                println("itemsList: ${itemsList.value.size}")
            })
        }
    }
}

// DraggableBehavior is responsible for handling the drag logic
@Composable
fun DraggableBehavior(
    name: String,
    shadowPic: MutableState<Pair<Float, Float>?>,
    onDragEnd: (String, Float, Float) -> Unit
) {
    var position by remember { mutableStateOf(Pair(0f, 0f)) }
//    var position by remember { mutableStateOf(Pair(0f, 0f)) }

    Box(
        modifier = Modifier
            .padding(10.dp)
            .size(100.dp)
            .background(Color.Cyan, shape = CircleShape)
            .onGloballyPositioned { coordinates ->
                // Get the initial position dynamically using onGloballyPositioned
                position = Pair(coordinates.positionInWindow().x, coordinates.positionInWindow().y)
            }
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    // Track drag for shadowPic
                    position = Pair(position.first + dragAmount.x, position.second + dragAmount.y)
                    shadowPic.value = position
                }
            }
    ) {
        Text(name, modifier = Modifier.align(Alignment.Center), color = Color.Black)
    }

    // When drag ends, add to the whiteboard if within bounds
    LaunchedEffect(shadowPic.value) {
        if (shadowPic.value != null) {
            onDragEnd(name, shadowPic.value!!.first, shadowPic.value!!.second)
            shadowPic.value = null // Reset shadowPic after placing the item
        }
    }
}

// DraggableItem is responsible for rendering the item on the whiteboard
@Composable
fun DraggableItem(name: String, x: Float, y: Float) {
    Box(
        modifier = Modifier
            .offset(x = x.dp, y = y.dp)
            .size(100.dp)
            .background(Color.Blue)
    ) {
        Text(name, modifier = Modifier.align(Alignment.Center), color = Color.White)
    }
}
private fun main() = application {
    Window(onCloseRequest = ::exitApplication) {
        WhiteboardDemo()
    }
}
