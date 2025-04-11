package org.example.project.domain.model

import androidx.compose.ui.geometry.Rect

data class Rect(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
){
    constructor( x: Float, y: Float, width: Float, height: Float) : this(
        x.toInt(), y.toInt(), width.toInt(), height.toInt()
    )
    fun toAndroidRect(): Rect {
        return androidx.compose.ui.geometry.Rect(
            x.toFloat(), 
            y.toFloat(),
            width.toFloat(), 
            height.toFloat())
    }
}
