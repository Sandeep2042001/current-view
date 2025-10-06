const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs').promises;
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class ThreeDReconstructionProcessor {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '3d_reconstruction.py');
    this.tempDir = path.join(__dirname, '../../temp');
  }

  async processReconstruction(job) {
    const { room_id, image_ids } = job.data;
    
    try {
      logger.info(`Starting 3D reconstruction for room ${room_id} with ${image_ids.length} images`);

      // Create temp directory for this job
      const jobTempDir = path.join(this.tempDir, `reconstruction_${job.id}`);
      await fs.mkdir(jobTempDir, { recursive: true });

      // Download images from MinIO
      logger.info('Downloading images from MinIO...');
      const imagePaths = await this.downloadImages(image_ids, jobTempDir);

      if (imagePaths.length < 2) {
        throw new Error('Need at least 2 images for 3D reconstruction');
      }

      // Run 3D reconstruction
      logger.info('Running 3D reconstruction pipeline...');
      const reconstructionResult = await this.runReconstruction(imagePaths, jobTempDir);

      if (!reconstructionResult.success) {
        throw new Error(reconstructionResult.error || '3D reconstruction failed');
      }

      // Upload results to MinIO
      logger.info('Uploading 3D reconstruction results...');
      const uploadedFiles = await this.uploadReconstruction(room_id, jobTempDir, reconstructionResult);

      // Update room with reconstruction data
      await db('rooms')
        .where({ id: room_id })
        .update({
          metadata: db.raw(`
            COALESCE(metadata, '{}'::json)::jsonb || ?::jsonb
          `, [JSON.stringify({
            reconstruction: {
              point_cloud_path: uploadedFiles.point_cloud,
              mesh_path: uploadedFiles.mesh,
              camera_poses_path: uploadedFiles.camera_poses,
              statistics: reconstructionResult.statistics,
              created_at: new Date().toISOString()
            }
          })]),
          status: 'completed',
          updated_at: db.fn.now()
        });

      // Cleanup temp files
      await this.cleanupTempFiles(jobTempDir);

      logger.info(`3D reconstruction completed for room ${room_id}`);

      return {
        success: true,
        room_id,
        point_cloud_path: uploadedFiles.point_cloud,
        mesh_path: uploadedFiles.mesh,
        statistics: reconstructionResult.statistics
      };

    } catch (error) {
      logger.error('Error in 3D reconstruction processor:', error);
      
      // Update room status to failed
      await db('rooms')
        .where({ id: room_id })
        .update({
          status: 'failed',
          updated_at: db.fn.now()
        });

      throw error;
    }
  }

  async downloadImages(imageIds, outputDir) {
    const minioClient = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || 'interactive360';
    
    const imagePaths = [];

    for (const imageId of imageIds) {
      try {
        // Get image record from database
        const image = await db('images').where({ id: imageId }).first();
        
        if (!image) {
          logger.warn(`Image ${imageId} not found in database`);
          continue;
        }

        // Download from MinIO
        const localPath = path.join(outputDir, `image_${imageId}.jpg`);
        const imageStream = await minioClient.getObject(bucket, image.storage_path);
        
        // Save to file
        const writeStream = require('fs').createWriteStream(localPath);
        await new Promise((resolve, reject) => {
          imageStream.pipe(writeStream);
          imageStream.on('end', resolve);
          imageStream.on('error', reject);
        });

        imagePaths.push(localPath);
        logger.info(`Downloaded image: ${image.filename}`);

      } catch (error) {
        logger.error(`Error downloading image ${imageId}:`, error);
      }
    }

    return imagePaths;
  }

  async runReconstruction(imagePaths, outputDir) {
    return new Promise((resolve, reject) => {
      const args = [...imagePaths, outputDir];
      
      const options = {
        mode: 'json',
        pythonPath: 'python3',
        pythonOptions: ['-u'],
        scriptPath: path.dirname(this.pythonScriptPath),
        args: args
      };

      PythonShell.run(path.basename(this.pythonScriptPath), options, (err, results) => {
        if (err) {
          logger.error('Python script error:', err);
          reject(err);
          return;
        }

        if (results && results.length > 0) {
          resolve(results[0]);
        } else {
          reject(new Error('No results from 3D reconstruction'));
        }
      });
    });
  }

  async uploadReconstruction(roomId, tempDir, reconstructionResult) {
    const minioClient = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || 'interactive360';
    const uploadedFiles = {};

    // Upload point cloud
    if (reconstructionResult.point_cloud_path) {
      const pointCloudPath = `reconstructions/${roomId}/point_cloud.ply`;
      await minioClient.fPutObject(
        bucket,
        pointCloudPath,
        reconstructionResult.point_cloud_path
      );
      uploadedFiles.point_cloud = pointCloudPath;
      logger.info(`Uploaded point cloud: ${pointCloudPath}`);
    }

    // Upload mesh
    if (reconstructionResult.mesh_path) {
      const meshPath = `reconstructions/${roomId}/mesh.obj`;
      await minioClient.fPutObject(
        bucket,
        meshPath,
        reconstructionResult.mesh_path
      );
      uploadedFiles.mesh = meshPath;
      logger.info(`Uploaded mesh: ${meshPath}`);
    }

    // Upload camera poses
    if (reconstructionResult.camera_poses) {
      const cameraPosesPath = `reconstructions/${roomId}/camera_poses.json`;
      const cameraPosesBuffer = Buffer.from(JSON.stringify(reconstructionResult.camera_poses, null, 2));
      await minioClient.putObject(
        bucket,
        cameraPosesPath,
        cameraPosesBuffer
      );
      uploadedFiles.camera_poses = cameraPosesPath;
    }

    return uploadedFiles;
  }

  async cleanupTempFiles(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      logger.info(`Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      logger.warn(`Failed to cleanup temp directory: ${error.message}`);
    }
  }
}

module.exports = { ThreeDReconstructionProcessor };

