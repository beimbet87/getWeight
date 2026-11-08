package com.getweight.cv

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getweight.cv.camera.CameraController
import com.getweight.cv.morphometry.BreedCondition
import com.getweight.cv.pipeline.WeightPipeline
import com.getweight.cv.ui.InkCameraOverlayView
import com.getweight.cv.ui.InkResultView

class MainActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: InkCameraOverlayView
    private lateinit var resultView: InkResultView
    private lateinit var cameraController: CameraController
    private lateinit var pipeline: WeightPipeline

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        previewView = findViewById(R.id.previewView)
        overlayView = findViewById(R.id.overlayView)
        resultView = findViewById(R.id.resultView)

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
        cameraController = CameraController(this, this, previewView) { bitmap, rotationDegrees ->
            val result = pipeline.processFrame(bitmap, BreedCondition.DAIRY_AVERAGE)
            val keypoints = pipeline.lastKeypoints
            val rejectionRate = pipeline.rejectionRate()
            val frameWidth = bitmap.width
            val frameHeight = bitmap.height
            runOnUiThread {
                overlayView.showKeypoints(keypoints, frameWidth, frameHeight, rotationDegrees)
                if (result != null) {
                    resultView.showResult(result)
                } else {
                    resultView.showRejected(rejectionRate)
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
