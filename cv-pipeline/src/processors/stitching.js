const sharp = require('sharp');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');

// Try to load python-shell for AI processing
let PythonShell = null;
try {
  PythonShell = require('python-shell').PythonShell;
} catch (e) {
  logger.warn('python-shell not available, AI panorama generation will be skipped');
}

async function processStitchingJob(job) {
  const { room_id, image_ids } = job.data;
  
  try {
    logger.info(`Starting stitching for room ${room_id} with ${image_ids.length} images`);
    logger.info(`Looking for images with IDs: ${JSON.stringify(image_ids)}`);

    // Get images from database
    const images = await db('images')
      .whereIn('id', image_ids)
      .orderBy('created_at', 'asc');

    logger.info(`Found ${images.length} images in database`);
    logger.info(`Image details: ${JSON.stringify(images.map(img => ({ id: img.id, filename: img.filename, room_id: img.room_id })))}`);

    if (images.length < 2) {
      logger.error(`Insufficient images found: ${images.length} (expected at least 2)`);
      logger.error(`Requested image IDs: ${JSON.stringify(image_ids)}`);
      logger.error(`Found image IDs: ${JSON.stringify(images.map(img => img.id))}`);
      throw new Error(`At least 2 images required for stitching. Found ${images.length} images.`);
    }

    // Download images from MinIO
    const minioClient = getMinioClient();
    const imageBuffers = [];
    
    for (const image of images) {
      try {
        logger.info(`Downloading image: ${image.filename} from path: ${image.storage_path}`);
        
        const stream = await minioClient.getObject(
          process.env.MINIO_BUCKET || 'interactive360',
          image.storage_path
        );
        
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        logger.info(`Downloaded image ${image.filename}: ${buffer.length} bytes`);
        
        imageBuffers.push({
          id: image.id,
          buffer: buffer,
          metadata: image.metadata,
          filename: image.filename
        });
      } catch (minioError) {
        logger.error(`Failed to download image ${image.filename}:`, minioError);
        throw new Error(`Failed to download image ${image.filename}: ${minioError.message}`);
      }
    }

    // Advanced Panorama Generator for professional-quality stitching
    logger.info(`Starting advanced panorama generation with ${imageBuffers.length} images`);
    
    // Save images temporarily for Python processing
    const tempDir = path.join(__dirname, '../../temp', `stitch_${job.jobId}`);
    const fs = require('fs').promises;
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempImagePaths = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const tempPath = path.join(tempDir, `image_${i}.jpg`);
      await fs.writeFile(tempPath, imageBuffers[i].buffer);
      tempImagePaths.push(tempPath);
    }
    
    // Call Advanced Panorama Generator
    let stitchedResult;
    
    if (PythonShell) {
      try {
        const aiResult = await new Promise((resolve, reject) => {
          const pythonScript = path.join(__dirname, 'advanced_panorama_generator.py');
          const args = [tempDir, ...tempImagePaths];
          
          PythonShell.run(pythonScript, {
            mode: 'json',
            pythonPath: 'python3',
            args: args
          }, (err, results) => {
            if (err) {
              logger.error('Advanced panorama generation failed:', err.message);
              reject(err);
            } else {
              resolve(results[0]);
            }
          });
        });
        
        if (aiResult.success) {
          // Read generated panorama
          const panoramaBuffer = await fs.readFile(aiResult.output_files.panorama);
          stitchedResult = {
            buffer: panoramaBuffer,
            quality: aiResult.quality_score * 100 || 95,
            processedImages: imageBuffers.length,
            rejectedImages: 0,
            method: aiResult.method,
            metadata: aiResult.metadata
          };
          logger.info(`Advanced panorama generation successful! Method: ${aiResult.method}, Quality: ${stitchedResult.quality}%`);
        } else {
          throw new Error(`Advanced panorama generation failed: ${aiResult.error || 'Unknown error'}`);
        }
        
      } catch (aiError) {
        logger.error('Advanced panorama generation failed:', aiError.message);
        throw new Error(`Failed to generate panorama: ${aiError.message}`);
      }
    } else {
      throw new Error('Python environment not available. Advanced panorama generation requires Python with OpenCV, SciPy, and Trimesh.');
    }
    
    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    
    logger.info(`Stitching completed. Quality: ${stitchedResult.quality}%, Method: ${stitchedResult.method || 'basic'}`);

    // Upload stitched image to MinIO
    const stitchedPath = `projects/${images[0].room_id}/stitched/panorama_${Date.now()}.jpg`;
    await minioClient.putObject(
      process.env.MINIO_BUCKET || 'interactive360',
      stitchedPath,
      stitchedResult.buffer,
      {
        'Content-Type': 'image/jpeg',
        'Content-Length': stitchedResult.buffer.length
      }
    );

    // Update room status with metadata INCLUDING panorama_path
    await db('rooms')
      .where({ id: room_id })
      .update({
        status: 'completed',
        metadata: db.raw(`
          COALESCE(metadata, '{}'::json)::jsonb || ?::jsonb
        `, [JSON.stringify({
          panorama_path: stitchedPath,  // PRIMARY field for Virtual Tour
          stitched_image_path: stitchedPath,
          stitched_image_size: stitchedResult.buffer.length,
          stitching_quality: stitchedResult.quality,
          stitching_method: stitchedResult.method || 'basic',
          is_360: true,
          processed_at: new Date().toISOString()
        })])
      });

    // Update image processing status
    await db('images')
      .whereIn('id', image_ids)
      .update({
        processing_status: {
          uploaded: true,
          processed: true,
          stitched: true
        }
      });

    logger.info(`Stitching completed for room ${room_id}`);
    console.log(`✅ STITCHING SUCCESS: Room ${room_id} - Quality: ${stitchedResult.quality}%`);

    // Auto-trigger hotspot generation after successful stitching
    try {
      console.log(`🎯 AUTO-TRIGGERING HOTSPOT GENERATION for room ${room_id}`);
      const { processHotspotGenerationJob } = require('./hotspots');
      
      const hotspotJob = {
        jobId: `hotspot-${room_id}-${Date.now()}`,
        type: 'hotspot_generation',
        data: { room_id: room_id }
      };
      
      const hotspotResult = await processHotspotGenerationJob(hotspotJob);
      console.log(`✅ HOTSPOTS GENERATED: ${hotspotResult.total_hotspots} hotspots created`);
      
    } catch (hotspotError) {
      console.error(`⚠️ Hotspot generation failed for room ${room_id}:`, hotspotError.message);
      // Don't fail the stitching job if hotspot generation fails
    }

    return {
      stitched_image_path: stitchedPath,
      stitched_image_size: stitchedResult.buffer.length,
      stitching_quality: stitchedResult.quality,
      quality: stitchedResult.quality,
      processed_images: image_ids.length,
      rejected_images: stitchedResult.rejectedImages || 0,
      quality_metrics: stitchedResult.qualityMetrics || {}
    };

  } catch (error) {
    logger.error(`Stitching failed for room ${room_id}:`, error);
    console.error(`❌ STITCHING FAILED: Room ${room_id} - ${error.message}`);
    
    // Update room status to failed
    await db('rooms')
      .where({ id: room_id })
      .update({ status: 'failed' });

    throw error;
  }
}

// All stitching logic is now handled by the advanced_panorama_generator.py
// This provides professional-quality stitching with:
// - Multi-algorithm feature detection (SIFT/SURF/ORB)
// - Bundle adjustment for optimal alignment
// - Multi-band blending for seamless results
// - Quality assessment and optimization

module.exports = {
  processStitchingJob
};
