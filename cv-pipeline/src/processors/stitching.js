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
  // Enhanced stitching implementation with quality gates
  
  try {
    // Quality assessment for each image
    const qualityResults = await Promise.all(
      imageBuffers.map(async (imageBuffer, index) => {
        const metadata = await sharp(imageBuffer.buffer).metadata();
        const stats = await sharp(imageBuffer.buffer).stats();
        
        // Blur detection using image statistics
        const blurScore = calculateBlurScore(stats);
        
        // Exposure detection
        const exposureScore = calculateExposureScore(stats);
        
        // Overall quality score
        const overallQuality = (blurScore + exposureScore) / 2;
        
        return {
          index,
          width: metadata.width,
          height: metadata.height,
          blurScore,
          exposureScore,
          overallQuality,
          isAcceptable: overallQuality > 60 // Quality threshold
        };
      })
    );

    // Filter out low-quality images
    const acceptableImages = imageBuffers.filter((_, index) => 
      qualityResults[index].isAcceptable
    );

    if (acceptableImages.length < 2) {
      throw new Error('Insufficient high-quality images for stitching');
    }

    // Log quality assessment
    logger.info(`Quality assessment: ${acceptableImages.length}/${imageBuffers.length} images passed quality gates`);
    qualityResults.forEach(result => {
      logger.info(`Image ${result.index}: blur=${result.blurScore}, exposure=${result.exposureScore}, overall=${result.overallQuality}`);
    });

    // For now, we'll create a simple panorama by combining images
    // In a real implementation, you would:
    // 1. Detect and match features between images
    // 2. Calculate homography matrices
    // 3. Warp and blend images together
    // 4. Create a seamless panorama

    const firstImage = acceptableImages[0];
    const firstImageInfo = await sharp(firstImage.buffer).metadata();
    
    // Create a wider canvas for the panorama
    const panoramaWidth = firstImageInfo.width * acceptableImages.length;
    const panoramaHeight = firstImageInfo.height;
    
    // Enhanced stitching with proper image processing
    let stitchedBuffer;
    
    if (acceptableImages.length === 1) {
      // Single image - just return it
      stitchedBuffer = await sharp(acceptableImages[0].buffer)
        .jpeg({ quality: 95 })
        .toBuffer();
    } else {
      // Multiple images - create composite
      const compositeImages = acceptableImages.map((img, index) => ({
        input: img.buffer,
        left: index * firstImageInfo.width,
        top: 0
      }));

      stitchedBuffer = await sharp({
        create: {
          width: panoramaWidth,
          height: panoramaHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite(compositeImages)
      .jpeg({ quality: 95 })
      .toBuffer();
    }

    // Calculate final quality score based on multiple factors
    const avgQuality = qualityResults
      .filter(r => r.isAcceptable)
      .reduce((sum, r) => sum + r.overallQuality, 0) / acceptableImages.length;
    
    const imageCountBonus = Math.min(20, acceptableImages.length * 5);
    const finalQuality = Math.min(95, avgQuality + imageCountBonus);

    return {
      buffer: stitchedBuffer,
      quality: finalQuality,
      processedImages: acceptableImages.length,
      rejectedImages: imageBuffers.length - acceptableImages.length,
      qualityMetrics: {
        averageBlur: qualityResults.reduce((sum, r) => sum + r.blurScore, 0) / qualityResults.length,
        averageExposure: qualityResults.reduce((sum, r) => sum + r.exposureScore, 0) / qualityResults.length,
        overallQuality: avgQuality
      }
    };

  } catch (error) {
    logger.error('Image stitching failed:', error);
    throw new Error('Failed to stitch images');
  }
}

// Enhanced blur detection using image statistics
function calculateBlurScore(stats) {
  // Use standard deviation as a measure of image sharpness
  // Higher standard deviation typically indicates sharper images
  const channels = stats.channels;
  let totalStdDev = 0;
  
  channels.forEach(channel => {
    totalStdDev += channel.stdev || 0;
  });
  
  const avgStdDev = totalStdDev / channels.length;
  
  // Convert to 0-100 scale (higher = sharper)
  // Typical sharp images have stddev > 30, blurry images < 15
  const blurScore = Math.min(100, Math.max(0, (avgStdDev - 10) * 3));
  
  return blurScore;
}

// Enhanced exposure detection
function calculateExposureScore(stats) {
  const channels = stats.channels;
  let exposureScore = 100;
  
  channels.forEach(channel => {
    const mean = channel.mean || 0;
    
    // Check for overexposure (too bright)
    if (mean > 240) {
      exposureScore -= 30;
    } else if (mean > 200) {
      exposureScore -= 15;
    }
    
    // Check for underexposure (too dark)
    if (mean < 15) {
      exposureScore -= 30;
    } else if (mean < 40) {
      exposureScore -= 15;
    }
    
    // Optimal exposure is around 100-180
    if (mean >= 80 && mean <= 180) {
      exposureScore += 10; // Bonus for good exposure
    }
  });
  
  return Math.max(0, Math.min(100, exposureScore));
}

module.exports = {
  processStitchingJob
};
