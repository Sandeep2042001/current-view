const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * Node.js wrapper for Python OpenCV stitching processor
 * Provides seamless integration between Node.js CV worker and Python OpenCV processing
 */
class PythonOpenCVStitchingProcessor {
  constructor() {
    this.pythonScript = path.join(__dirname, 'opencv_stitching.py');
    this.tempDir = path.join(__dirname, '../../temp');
    this.maxProcessingTime = 300000; // 5 minutes timeout
  }

  /**
   * Process stitching job using Python OpenCV processor
   * @param {Object} job - Stitching job data
   * @returns {Promise<Object>} Processing result
   */
  async processStitchingJob(job) {
    const { room_id, image_ids } = job.data;
    
    try {
      logger.info(`Starting Python OpenCV stitching for room ${room_id}`);
      
      // Create temp directory if it doesn't exist
      await this.ensureTempDirectory();
      
      // Prepare image files for Python processing
      const imageFiles = await this.prepareImageFiles(image_ids);
      
      if (imageFiles.length < 2) {
        throw new Error(`Insufficient images for stitching: ${imageFiles.length}`);
      }
      
      // Run Python OpenCV stitching
      const result = await this.runPythonStitching(imageFiles, room_id);
      
      // Upload result to MinIO
      const uploadedPath = await this.uploadResult(result, room_id);
      
      // Clean up temp files
      await this.cleanupTempFiles(imageFiles);
      
      logger.info(`Python OpenCV stitching completed for room ${room_id}`);
      
      return {
        success: true,
        stitched_image_path: uploadedPath,
        quality_score: result.quality_score,
        processed_images: result.processed_images,
        rejected_images: result.rejected_images,
        metadata: result.metadata
      };
      
    } catch (error) {
      logger.error(`Python OpenCV stitching failed for room ${room_id}:`, error);
      
      // Clean up temp files on error
      await this.cleanupTempFiles(imageFiles || []);
      
      throw error;
    }
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDirectory() {
    try {
      await fs.access(this.tempDir);
    } catch (error) {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`Created temp directory: ${this.tempDir}`);
    }
  }

  /**
   * Prepare image files for Python processing
   * @param {Array} imageIds - Array of image IDs
   * @returns {Promise<Array>} Array of temporary image file paths
   */
  async prepareImageFiles(imageIds) {
    const { getMinioClient } = require('../config/minio');
    const { db } = require('../config/database');
    
    const minioClient = getMinioClient();
    const imageFiles = [];
    
    // Get image metadata from database
    const images = await db('images')
      .whereIn('id', imageIds)
      .orderBy('created_at', 'asc');
    
    logger.info(`Preparing ${images.length} images for Python processing`);
    
    for (const image of images) {
      try {
        // Download image from MinIO
        const stream = await minioClient.getObject(
          process.env.MINIO_BUCKET || 'interactive360',
          image.storage_path
        );
        
        // Save to temp file
        const tempPath = path.join(this.tempDir, `temp_${image.id}.jpg`);
        const chunks = [];
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        await fs.writeFile(tempPath, Buffer.concat(chunks));
        imageFiles.push(tempPath);
        
        logger.info(`Prepared image: ${image.filename} -> ${tempPath}`);
        
      } catch (error) {
        logger.error(`Failed to prepare image ${image.filename}:`, error);
        throw new Error(`Failed to prepare image ${image.filename}: ${error.message}`);
      }
    }
    
    return imageFiles;
  }

  /**
   * Run Python OpenCV stitching process
   * @param {Array} imageFiles - Array of image file paths
   * @param {string} roomId - Room ID for output naming
   * @returns {Promise<Object>} Stitching result
   */
  async runPythonStitching(imageFiles, roomId) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `panorama_${roomId}_${Date.now()}.jpg`);
      
      // Prepare command arguments
      const args = [outputPath, ...imageFiles];
      
      logger.info(`Running Python OpenCV stitching with ${imageFiles.length} images`);
      logger.info(`Command: python3 ${this.pythonScript} ${args.join(' ')}`);
      
      // Spawn Python process
      const pythonProcess = spawn('python3', [this.pythonScript, ...args], {
        cwd: path.dirname(this.pythonScript),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      // Collect output
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.info(`Python stdout: ${data.toString().trim()}`);
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`Python stderr: ${data.toString().trim()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', async (code) => {
        logger.info(`Python process exited with code: ${code}`);
        
        if (code === 0) {
          try {
            // Check if output file was created
            await fs.access(outputPath);
            
            // Parse output for metadata
            const result = await this.parsePythonOutput(stdout, outputPath);
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Output file not created: ${error.message}`));
          }
        } else {
          reject(new Error(`Python process failed with code ${code}. Stderr: ${stderr}`));
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        logger.error(`Python process error:`, error);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
      
      // Set timeout
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Python stitching process timed out'));
      }, this.maxProcessingTime);
      
      // Clear timeout on completion
      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse Python process output to extract metadata
   * @param {string} stdout - Python process stdout
   * @param {string} outputPath - Path to output panorama
   * @returns {Promise<Object>} Parsed result
   */
  async parsePythonOutput(stdout, outputPath) {
    try {
      // Get file stats
      const stats = await fs.stat(outputPath);
      
      // Parse stdout for quality information
      const qualityMatch = stdout.match(/Quality: ([\d.]+)%/);
      const processedMatch = stdout.match(/Processed: (\d+) images/);
      const rejectedMatch = stdout.match(/Rejected: (\d+) images/);
      
      return {
        output_path: outputPath,
        quality_score: qualityMatch ? parseFloat(qualityMatch[1]) : 85.0,
        processed_images: processedMatch ? parseInt(processedMatch[1]) : 0,
        rejected_images: rejectedMatch ? parseInt(rejectedMatch[1]) : 0,
        file_size: stats.size,
        metadata: {
          processing_method: 'python_opencv',
          timestamp: new Date().toISOString(),
          stdout: stdout.trim()
        }
      };
      
    } catch (error) {
      logger.error('Error parsing Python output:', error);
      return {
        output_path: outputPath,
        quality_score: 85.0,
        processed_images: 0,
        rejected_images: 0,
        file_size: 0,
        metadata: {
          processing_method: 'python_opencv',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Upload stitching result to MinIO
   * @param {Object} result - Stitching result
   * @param {string} roomId - Room ID
   * @returns {Promise<string>} MinIO storage path
   */
  async uploadResult(result, roomId) {
    const { getMinioClient } = require('../config/minio');
    const minioClient = getMinioClient();
    
    const stitchedPath = `projects/${roomId}/stitched/panorama_${Date.now()}.jpg`;
    
    try {
      // Read the output file
      const fileBuffer = await fs.readFile(result.output_path);
      
      // Upload to MinIO
      await minioClient.putObject(
        process.env.MINIO_BUCKET || 'interactive360',
        stitchedPath,
        fileBuffer,
        {
          'Content-Type': 'image/jpeg',
          'Content-Length': fileBuffer.length,
          'X-Quality-Score': result.quality_score.toString(),
          'X-Processing-Method': 'python_opencv'
        }
      );
      
      logger.info(`Uploaded stitched panorama to MinIO: ${stitchedPath}`);
      
      return stitchedPath;
      
    } catch (error) {
      logger.error('Failed to upload result to MinIO:', error);
      throw new Error(`Failed to upload result: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   * @param {Array} imageFiles - Array of temporary file paths
   */
  async cleanupTempFiles(imageFiles) {
    try {
      for (const filePath of imageFiles) {
        try {
          await fs.unlink(filePath);
          logger.info(`Cleaned up temp file: ${filePath}`);
        } catch (error) {
          logger.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Check if Python and OpenCV are available
   * @returns {Promise<boolean>} Availability status
   */
  async checkAvailability() {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['-c', 'import cv2; print("OpenCV available")'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      pythonProcess.on('close', (code) => {
        resolve(code === 0);
      });
      
      pythonProcess.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        resolve(false);
      }, 10000);
    });
  }
}

module.exports = {
  PythonOpenCVStitchingProcessor
};