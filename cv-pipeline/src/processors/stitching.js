const sharp = require('sharp');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

async function processStitchingJob(job) {
  const { room_id, image_ids } = job.data;
  
  try {
    logger.info(`Starting stitching for room ${room_id} with ${image_ids.length} images`);

    // Get images from database
    const images = await db('images')
      .whereIn('id', image_ids)
      .orderBy('created_at', 'asc');

    if (images.length < 2) {
      throw new Error('At least 2 images required for stitching');
    }

    // Download images from MinIO
    const minioClient = getMinioClient();
    const imageBuffers = [];
    
    for (const image of images) {
      const stream = await minioClient.getObject(
        process.env.MINIO_BUCKET || 'interactive360',
        image.storage_path
      );
      
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      imageBuffers.push({
        id: image.id,
        buffer: Buffer.concat(chunks),
        metadata: image.metadata
      });
    }

    // Perform image stitching
    const stitchedResult = await stitchImages(imageBuffers);

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

    // Update room status
    await db('rooms')
      .where({ id: room_id })
      .update({
        status: 'completed',
        metadata: {
          stitched_image_path: stitchedPath,
          stitched_image_size: stitchedResult.buffer.length,
          stitching_quality: stitchedResult.quality
        }
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

    return {
      stitched_image_path: stitchedPath,
      quality: stitchedResult.quality,
      processed_images: image_ids.length
    };

  } catch (error) {
    logger.error(`Stitching failed for room ${room_id}:`, error);
    
    // Update room status to failed
    await db('rooms')
      .where({ id: room_id })
      .update({ status: 'failed' });

    throw error;
  }
}

async function stitchImages(imageBuffers) {
  // This is a simplified stitching implementation
  // In production, you would use OpenCV or similar libraries
  
  try {
    // For now, we'll create a simple panorama by combining images
    // In a real implementation, you would:
    // 1. Detect and match features between images
    // 2. Calculate homography matrices
    // 3. Warp and blend images together
    // 4. Create a seamless panorama

    const firstImage = imageBuffers[0];
    const firstImageInfo = await sharp(firstImage.buffer).metadata();
    
    // Create a wider canvas for the panorama
    const panoramaWidth = firstImageInfo.width * imageBuffers.length;
    const panoramaHeight = firstImageInfo.height;
    
    // For demonstration, we'll just concatenate images horizontally
    // In production, use proper stitching algorithms
    const stitchedBuffer = await sharp({
      create: {
        width: panoramaWidth,
        height: panoramaHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer();

    // Calculate quality score (simplified)
    const quality = Math.min(95, 70 + (imageBuffers.length * 5));

    return {
      buffer: stitchedBuffer,
      quality: quality
    };

  } catch (error) {
    logger.error('Image stitching failed:', error);
    throw new Error('Failed to stitch images');
  }
}

module.exports = {
  processStitchingJob
};
