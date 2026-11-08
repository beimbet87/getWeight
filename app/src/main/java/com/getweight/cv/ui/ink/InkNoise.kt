package com.getweight.cv.ui.ink

import kotlin.math.floor

/** Детерминированный 1D value noise для «живых» неровностей линии. */
internal object InkNoise {

    /** Псевдослучайное значение в [-1, 1] для целого аргумента. */
    fun hash(i: Int, seed: Int): Float {
        var h = i * 374761393 + seed * 668265263
        h = (h xor (h ushr 13)) * 1274126177
        h = h xor (h ushr 16)
        return (h and 0x7fffffff) / 2147483647f * 2f - 1f
    }

    /** Гладкий шум в [-1, 1]. */
    fun value(x: Float, seed: Int): Float {
        val fl = floor(x)
        val i = fl.toInt()
        val f = x - fl
        val u = f * f * (3f - 2f * f)
        val a = hash(i, seed)
        val b = hash(i + 1, seed)
        return a + (b - a) * u
    }
}
