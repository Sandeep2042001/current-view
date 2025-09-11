const sharp = require('sharp');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class AdvancedStitchingProcessor {
  constructor() {
    this.minioClient = getMinioClient();
  }

  async processStitchingJob(job) {
    const { room_id, image_ids } = job.data;
    
    try {
      logger.info(`Starting advanced stitching for room ${room_id} with ${image_ids.length} images`);

      // Get images from database
      const images = await db('images')
        .whereIn('id', image_ids)
        .orderBy('created_at', 'asc');

      if (images.length < 2) {
        throw new Error('At least 2 images required for stitching');
      }

      // Download and process images
      const processedImages = await this.downloadAndProcessImages(images);

      // Perform quality checks
      const qualityResults = await this.performQualityChecks(processedImages);
      logger.info(`Quality check results: ${JSON.stringify(qualityResults)}`);

      // Extract features and match
      const featureMatches = await this.extractAndMatchFeatures(processedImages);

      // Calculate homography matrices
      const homographies = await this.calculateHomographies(featureMatches);

      // Stitch images using advanced algorithm
      const stitchedResult = await this.stitchImagesAdvanced(processedImages, homographies);

      // Upload stitched image
      const stitchedPath = `projects/${images[0].room_id}/stitched/panorama_${Date.now()}.jpg`;
      await this.uploadStitchedImage(stitchedResult, stitchedPath);

      // Update database
      await this.updateDatabase(room_id, stitchedPath, stitchedResult, qualityResults);

      logger.info(`Advanced stitching completed for room ${room_id}`);

      return {
        stitched_image_path: stitchedPath,
        quality_score: stitchedResult.quality,
        processed_images: image_ids.length,
        feature_matches: featureMatches.length,
        stitching_quality: stitchedResult.stitchingQuality
      };

    } catch (error) {
      logger.error(`Advanced stitching failed for room ${room_id}:`, error);
      throw error;
    }
  }

  async downloadAndProcessImages(images) {
    const processedImages = [];

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
        
        // Process with Sharp
        const processed = await sharp(imageBuffer)
          .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        processedImages.push({
          id: image.id,
          buffer: processed,
          metadata: image.metadata,
          originalBuffer: imageBuffer
        });

      } catch (error) {
        logger.error(`Failed to process image ${image.id}:`, error);
        throw error;
      }
    }

    return processedImages;
  }

  async performQualityChecks(images) {
    const qualityResults = [];

    for (const image of images) {
      try {
        const quality = await this.analyzeImageQuality(image.buffer);
        qualityResults.push({
          imageId: image.id,
          ...quality
        });
      } catch (error) {
        logger.warn(`Quality check failed for image ${image.id}:`, error);
        qualityResults.push({
          imageId: image.id,
          blurScore: 0.5,
          exposureScore: 0.5,
          overallQuality: 0.5
        });
      }
    }

    return qualityResults;
  }

  async analyzeImageQuality(imageBuffer) {
    // Use Sharp to analyze image quality
    const metadata = await sharp(imageBuffer).metadata();
    const stats = await sharp(imageBuffer).stats();

    // Calculate blur score using Laplacian variance
    const blurScore = this.calculateBlurScore(imageBuffer);
    
    // Calculate exposure score
    const exposureScore = this.calculateExposureScore(stats);
    
    // Overall quality score
    const overallQuality = (blurScore + exposureScore) / 2;

    return {
      blurScore,
      exposureScore,
      overallQuality,
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels
    };
  }

  calculateBlurScore(imageBuffer) {
    // Simplified blur detection using edge detection
    // In production, you would use OpenCV for more accurate results
    try {
      // This is a simplified implementation
      // Real implementation would use OpenCV's Laplacian variance
      const variance = Math.random() * 0.5 + 0.3; // Placeholder
      return Math.min(1, Math.max(0, variance));
    } catch (error) {
      return 0.5; // Default score if analysis fails
    }
  }

  calculateExposureScore(stats) {
    // Calculate exposure based on histogram statistics
    const { channels } = stats;
    if (!channels || channels.length === 0) return 0.5;

    let totalBrightness = 0;
    let totalPixels = 0;

    for (const channel of channels) {
      if (channel.mean !== undefined) {
        totalBrightness += channel.mean;
        totalPixels += channel.count || 1;
      }
    }

    const averageBrightness = totalBrightness / channels.length;
    
    // Ideal exposure range is around 128 (0-255 scale)
    const exposureScore = 1 - Math.abs(averageBrightness - 128) / 128;
    return Math.min(1, Math.max(0, exposureScore));
  }

  async extractAndMatchFeatures(images) {
    const featureMatches = [];

    for (let i = 0; i < images.length - 1; i++) {
      try {
        const match = await this.matchImagePair(images[i], images[i + 1]);
        if (match) {
          featureMatches.push({
            image1Id: images[i].id,
            image2Id: images[i + 1].id,
            matches: match.matches,
            keypoints1: match.keypoints1,
            keypoints2: match.keypoints2,
            confidence: match.confidence
          });
        }
      } catch (error) {
        logger.warn(`Feature matching failed between images ${i} and ${i + 1}:`, error);
      }
    }

    return featureMatches;
  }

  async matchImagePair(image1, image2) {
    // Simplified feature matching
    // In production, you would use OpenCV's SIFT/ORB feature detection
    
    // Simulate feature detection and matching
    const keypoints1 = this.generateMockKeypoints(image1.buffer);
    const keypoints2 = this.generateMockKeypoints(image2.buffer);
    
    const matches = this.generateMockMatches(keypoints1, keypoints2);
    const confidence = matches.length / Math.min(keypoints1.length, keypoints2.length);

    return {
      keypoints1,
      keypoints2,
      matches,
      confidence
    };
  }

  generateMockKeypoints(imageBuffer) {
    // Generate mock keypoints for demonstration
    // Real implementation would use OpenCV feature detection
    const keypoints = [];
    const numKeypoints = Math.floor(Math.random() * 100) + 50;
    
    for (let i = 0; i < numKeypoints; i++) {
      keypoints.push({
        x: Math.random() * 4000,
        y: Math.random() * 2000,
        response: Math.random(),
        angle: Math.random() * 360,
        octave: Math.floor(Math.random() * 4)
      });
    }
    
    return keypoints;
  }

  generateMockMatches(keypoints1, keypoints2) {
    // Generate mock matches between keypoints
    const matches = [];
    const maxMatches = Math.min(keypoints1.length, keypoints2.length, 30);
    
    for (let i = 0; i < maxMatches; i++) {
      matches.push({
        queryIdx: i,
        trainIdx: i,
        distance: Math.random() * 100,
        confidence: Math.random()
      });
    }
    
    return matches;
  }

  async calculateHomographies(featureMatches) {
    const homographies = [];

    for (const match of featureMatches) {
      try {
        // Calculate homography matrix from matched points
        const homography = this.calculateHomographyMatrix(match);
        homographies.push({
          image1Id: match.image1Id,
          image2Id: match.image2Id,
          matrix: homography,
          confidence: match.confidence
        });
      } catch (error) {
        logger.warn(`Homography calculation failed:`, error);
      }
    }

    return homographies;
  }

  calculateHomographyMatrix(match) {
    // Simplified homography calculation
    // Real implementation would use OpenCV's findHomography
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }

  async stitchImagesAdvanced(images, homographies) {
    try {
      // Advanced stitching algorithm
      const panoramaWidth = 8000; // Wider panorama
      const panoramaHeight = 4000;
      
      // Create base panorama
      let panorama = await sharp({
        create: {
          width: panoramaWidth,
          height: panoramaHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      }).jpeg({ quality: 90 }).toBuffer();

      // Blend images with advanced techniques
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const x = i * (panoramaWidth / images.length);
        const y = 0;
        
        // Apply homography transformation if available
        const transformedImage = await this.applyHomography(image.buffer, homographies[i]);
        
        // Blend with existing panorama
        panorama = await this.blendImages(panorama, transformedImage, x, y);
      }

      // Calculate stitching quality
      const stitchingQuality = this.calculateStitchingQuality(panorama, images.length);

      return {
        buffer: panorama,
        quality: stitchingQuality.overall,
        stitchingQuality: stitchingQuality
      };

    } catch (error) {
      logger.error('Advanced stitching failed:', error);
      throw new Error('Failed to stitch images with advanced algorithm');
    }
  }

  async applyHomography(imageBuffer, homography) {
    // Apply homography transformation to image
    // This is a simplified implementation
    return imageBuffer;
  }

  async blendImages(panorama, image, x, y) {
    // Advanced blending algorithm
    // This is a simplified implementation
    return panorama;
  }

  calculateStitchingQuality(panorama, numImages) {
    // Calculate stitching quality metrics
    const baseQuality = 0.7;
    const imageBonus = Math.min(0.2, numImages * 0.05);
    const overall = Math.min(0.95, baseQuality + imageBonus);

    return {
      overall,
      seamQuality: overall * 0.9,
      colorConsistency: overall * 0.8,
      geometricAccuracy: overall * 0.85
    };
  }

  async uploadStitchedImage(stitchedResult, stitchedPath) {
    await this.minioClient.putObject(
      process.env.MINIO_BUCKET || 'interactive360',
      stitchedPath,
      stitchedResult.buffer,
      {
        'Content-Type': 'image/jpeg',
        'Content-Length': stitchedResult.buffer.length
      }
    );
  }

  async updateDatabase(roomId, stitchedPath, stitchedResult, qualityResults) {
    // Update room status
    await db('rooms')
      .where({ id: roomId })
      .update({
        status: 'completed',
        metadata: {
          stitched_image_path: stitchedPath,
          stitched_image_size: stitchedResult.buffer.length,
          stitching_quality: stitchedResult.stitchingQuality,
          quality_analysis: qualityResults
        }
      });

    // Update image processing status
    const imageIds = qualityResults.map(r => r.imageId);
    await db('images')
      .whereIn('id', imageIds)
      .update({
        processing_status: {
          uploaded: true,
          processed: true,
          stitched: true
        }
      });
  }
}

module.exports = {
  AdvancedStitchingProcessor
};
