package com.getweight.cv

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getweight.cv.camera.CameraController
import com.getweight.cv.morphometry.BreedCondition
import com.getweight.cv.pipeline.WeightPipeline

class MainActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var resultText: TextView
    private lateinit var cameraController: CameraController
    private lateinit var pipeline: WeightPipeline

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        previewView = findViewById(R.id.previewView)
        resultText = findViewById(R.id.resultText)

        pipeline = WeightPipeline(this)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA)
        } else {
            startCamera()
        }
    }

    private fun startCamera() {
        cameraController = CameraController(this, this, previewView) { bitmap, _ ->
            val result = pipeline.processFrame(bitmap, BreedCondition.DAIRY_AVERAGE)
            runOnUiThread {
                resultText.text = if (result != null) {
                    "Вес: %.1f кг (±%.1f), кадров: %d, метод: %s".format(
                        result.weightKg, result.confidenceIntervalKg, result.framesUsed, result.method
                    )
                } else {
                    "Кадр отбракован (маркер/поза не валидны). Отбраковка: %.0f%%".format(
                        pipeline.rejectionRate() * 100
                    )
                }
            }
        }
        cameraController.start()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        pipeline.close()
        if (::cameraController.isInitialized) {
            cameraController.stop()
        }
    }

    companion object {
        private const val REQUEST_CAMERA = 100
    }
}
