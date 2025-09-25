const { spawn } = require('child_process');
const path = require('path');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class PythonOpenCVStitchingProcessor {
  constructor() {
    this.minioClient = getMinioClient();
    this.pythonScriptPath = path.join(__dirname, 'python_stitching.py');
  }

  async processStitchingJob(job) {
    const { room_id, image_ids } = job.data;
    
    try {
      logger.info(`Starting Python OpenCV stitching for room ${room_id} with ${image_ids.length} images`);
      console.log(`🐍 PYTHON OPENCV STITCHING: Room ${room_id} - ${image_ids.length} images`);

      // Get images from database
      const images = await db('images')
        .whereIn('id', image_ids)
        .orderBy('created_at', 'asc');

      if (images.length < 2) {
        throw new Error('At least 2 images required for stitching');
      }

      // Download images from MinIO and save temporarily
      const tempImagePaths = await this.downloadImagesToTemp(images);
      
      // Prepare job data for Python processor
      const jobData = {
        room_id,
        image_ids,
        image_paths: tempImagePaths
      };

      // Call Python processor
      const result = await this.callPythonProcessor(jobData);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Upload stitched image to MinIO
      const stitchedPath = `projects/${images[0].room_id}/stitched/panorama_${Date.now()}.jpg`;
      await this.uploadStitchedImage(result.stitched_image_path, stitchedPath);

      // Update database
      await this.updateDatabase(room_id, stitchedPath, result);

      // Clean up temporary files
      await this.cleanupTempFiles(tempImagePaths);
      if (result.stitched_image_path) {
        await this.cleanupTempFiles([result.stitched_image_path]);
      }

      console.log(`✅ PYTHON OPENCV SUCCESS: Room ${room_id} - Quality: ${result.quality_score}%`);
      logger.info(`Python OpenCV stitching completed for room ${room_id}`);

      return {
        stitched_image_path: stitchedPath,
        quality_score: result.quality_score,
        processed_images: result.processed_images,
        feature_matches: result.feature_matches,
        stitching_quality: { overall: result.quality_score / 100 },
        homographies_calculated: result.homographies_calculated,
        total_keypoints: result.total_keypoints,
        stitching_method: 'python_opencv'
      };

    } catch (error) {
      logger.error(`Python OpenCV stitching failed for room ${room_id}:`, error);
      console.error(`❌ PYTHON OPENCV FAILED: Room ${room_id} - ${error.message}`);
      throw error;
    }
  }

  async downloadImagesToTemp(images) {
    const tempPaths = [];
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    for (const image of images) {
      try {
        // Download from MinIO
        const stream = await this.minioClient.getObject(
          process.env.MINIO_BUCKET || 'interactive360',
          image.storage_path
        );
        
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const imageBuffer = Buffer.concat(chunks);
        
        // Save to temporary file
        const tempPath = path.join(os.tmpdir(), `temp_image_${image.id}.jpg`);
        fs.writeFileSync(tempPath, imageBuffer);
        
        tempPaths.push(tempPath);
        
      } catch (error) {
        logger.error(`Failed to download image ${image.id}:`, error);
        throw error;
      }
    }

    return tempPaths;
  }

  async callPythonProcessor(jobData) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScriptPath, JSON.stringify(jobData)]);
      
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python processor exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python processor output: ${error.message}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python processor: ${error.message}`));
      });
    });
  }

  async uploadStitchedImage(localPath, remotePath) {
    const fs = require('fs');
    
    try {
      const imageBuffer = fs.readFileSync(localPath);
      
      await this.minioClient.putObject(
        process.env.MINIO_BUCKET || 'interactive360',
        remotePath,
        imageBuffer,
        {
          'Content-Type': 'image/jpeg',
          'Content-Length': imageBuffer.length
        }
      );
      
    } catch (error) {
      logger.error('Failed to upload stitched image:', error);
      throw error;
    }
  }

  async updateDatabase(roomId, stitchedPath, result) {
    // Update room status
    await db('rooms')
      .where({ id: roomId })
      .update({
        status: 'completed',
        metadata: {
          stitched_image_path: stitchedPath,
          stitching_quality: result.quality_score / 100,
          stitching_method: 'python_opencv',
          feature_matches: result.feature_matches,
          total_keypoints: result.total_keypoints
        }
      });

    // Update image processing status
    const imageIds = result.processed_images ? 
      await db('images').where({ room_id: roomId }).select('id') :
      [];
    
    if (imageIds.length > 0) {
      await db('images')
        .whereIn('id', imageIds.map(img => img.id))
        .update({
          processing_status: {
            uploaded: true,
            processed: true,
            stitched: true
          }
        });
    }
  }

  async cleanupTempFiles(filePaths) {
    const fs = require('fs');
    
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    }
  }
}

module.exports = {
  PythonOpenCVStitchingProcessor
};
