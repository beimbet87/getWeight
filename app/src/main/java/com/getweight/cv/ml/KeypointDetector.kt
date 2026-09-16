package com.getweight.cv.ml

import android.content.Context
import android.graphics.Bitmap
import com.getweight.cv.model.BodyLandmark
import com.getweight.cv.model.Keypoint
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import java.io.Closeable

/**
 * Обёртка над TFLite-моделью ключевых точек (архитектура в духе YOLOv8-pose /
 * MoveNet, дообученной на разметке КРС). Модель экспортируется с фиксированным
 * числом ключевых точек = BodyLandmark.values().size и выходным тензором
 * формы [1, N, 3] — (x, y, confidence) в координатах, нормализованных к [0, 1]
 * относительно входа модели.
 */
class KeypointDetector(
    context: Context,
    modelPath: String = "models/cattle_keypoints_fp16.tflite",
    private val inputSize: Int = 256
) : Closeable {

    private val landmarks = BodyLandmark.values()
    private val interpreter: Interpreter
    private val gpuDelegate: GpuDelegate?

    private val imageProcessor = ImageProcessor.Builder()
        .add(ResizeOp(inputSize, inputSize, ResizeOp.ResizeMethod.BILINEAR))
        .build()

    init {
        val compatList = CompatibilityList()
        val options = Interpreter.Options()
        gpuDelegate = if (compatList.isDelegateSupportedOnThisDevice) {
            GpuDelegate(compatList.bestOptionsForThisDevice).also { options.addDelegate(it) }
        } else {
            options.setNumThreads(4)
            null
        }
        val modelBuffer = FileUtil.loadMappedFile(context, modelPath)
        interpreter = Interpreter(modelBuffer, options)
    }

    fun detect(bitmap: Bitmap): Map<BodyLandmark, Keypoint> {
        val tensorImage = imageProcessor.process(TensorImage.fromBitmap(bitmap))
        val output = Array(1) { Array(landmarks.size) { FloatArray(3) } }
        interpreter.run(tensorImage.buffer, output)

        val result = LinkedHashMap<BodyLandmark, Keypoint>()
        for (i in landmarks.indices) {
            val row = output[0][i]
            val nx = row[0]
            val ny = row[1]
            val conf = row[2]
            result[landmarks[i]] = Keypoint(
                name = landmarks[i],
                xPx = nx * bitmap.width,
                yPx = ny * bitmap.height,
                confidence = conf
            )
        }
        return result
    }

    override fun close() {
        interpreter.close()
        gpuDelegate?.close()
    }
}
