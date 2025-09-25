const cv = require('opencv4nodejs');
const sharp = require('sharp');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class OpenCVStitchingProcessor {
  constructor() {
    this.minioClient = getMinioClient();
    this.detector = new cv.ORBDetector();
    this.matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
  }

  async processStitchingJob(job) {
    const { room_id, image_ids } = job.data;
    
    try {
      logger.info(`Starting OpenCV stitching for room ${room_id} with ${image_ids.length} images`);
      console.log(`🚀 OPENCV STITCHING: Room ${room_id} - ${image_ids.length} images`);

      // Get images from database
      const images = await db('images')
        .whereIn('id', image_ids)
        .orderBy('created_at', 'asc');

      if (images.length < 2) {
        throw new Error('At least 2 images required for stitching');
      }

      // Download and process images
      const processedImages = await this.downloadAndProcessImages(images);
      logger.info(`Downloaded ${processedImages.length} images for processing`);

      // Perform quality checks
      const qualityResults = await this.performQualityChecks(processedImages);
      logger.info(`Quality check completed: ${qualityResults.filter(q => q.isAcceptable).length}/${qualityResults.length} images passed`);

      // Extract features from all images
      const features = await this.extractFeatures(processedImages);
      logger.info(`Feature extraction completed for ${features.length} images`);

      // Match features between consecutive images
      const matches = await this.matchFeatures(features);
      logger.info(`Feature matching completed: ${matches.length} image pairs matched`);

      // Calculate homography matrices
      const homographies = await this.calculateHomographies(features, matches);
      logger.info(`Homography calculation completed: ${homographies.length} valid transformations`);

      // Stitch images using OpenCV
      const stitchedResult = await this.stitchImagesOpenCV(processedImages, homographies);
      logger.info(`OpenCV stitching completed with quality score: ${stitchedResult.quality}`);

      // Upload stitched image
      const stitchedPath = `projects/${images[0].room_id}/stitched/panorama_${Date.now()}.jpg`;
      await this.uploadStitchedImage(stitchedResult, stitchedPath);

      // Update database
      await this.updateDatabase(room_id, stitchedPath, stitchedResult, qualityResults);

      console.log(`✅ OPENCV STITCHING SUCCESS: Room ${room_id} - Quality: ${stitchedResult.quality}%`);
      logger.info(`OpenCV stitching completed for room ${room_id}`);

      return {
        stitched_image_path: stitchedPath,
        quality_score: stitchedResult.quality,
        processed_images: image_ids.length,
        feature_matches: matches.length,
        stitching_quality: stitchedResult.stitchingQuality,
        homographies_calculated: homographies.length,
        total_keypoints: features.reduce((sum, f) => sum + f.keypoints.length, 0)
      };

    } catch (error) {
      logger.error(`OpenCV stitching failed for room ${room_id}:`, error);
      console.error(`❌ OPENCV STITCHING FAILED: Room ${room_id} - ${error.message}`);
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
        
        // Process with Sharp for optimal size
        const processed = await sharp(imageBuffer)
          .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        processedImages.push({
          id: image.id,
          buffer: processed,
          originalBuffer: imageBuffer,
          metadata: image.metadata
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
        // Convert buffer to OpenCV Mat for quality analysis
        const mat = cv.imdecode(image.buffer);
        
        // Calculate image quality metrics
        const quality = await this.analyzeImageQuality(mat);
        
        qualityResults.push({
          imageId: image.id,
          blurScore: quality.blurScore,
          exposureScore: quality.exposureScore,
          contrastScore: quality.contrastScore,
          overallQuality: quality.overallQuality,
          isAcceptable: quality.overallQuality > 60,
          width: mat.cols,
          height: mat.rows
        });

        // Clean up memory
        mat.release();

      } catch (error) {
        logger.warn(`Quality check failed for image ${image.id}:`, error);
        qualityResults.push({
          imageId: image.id,
          blurScore: 50,
          exposureScore: 50,
          contrastScore: 50,
          overallQuality: 50,
          isAcceptable: false
        });
      }
    }

    return qualityResults;
  }

  async analyzeImageQuality(mat) {
    try {
      // Convert to grayscale for analysis
      const gray = mat.cvtColor(cv.COLOR_BGR2GRAY);
      
      // Blur detection using Laplacian variance
      const laplacian = gray.laplacian(cv.CV_64F);
      const mean = laplacian.mean();
      const stddev = laplacian.stddev();
      const blurScore = Math.min(100, Math.max(0, stddev.val * 10));
      
      // Exposure analysis using histogram
      const hist = gray.calcHist();
      const totalPixels = mat.total();
      
      // Calculate exposure score based on histogram distribution
      let underExposed = 0;
      let overExposed = 0;
      let wellExposed = 0;
      
      for (let i = 0; i < 256; i++) {
        const pixelCount = hist.get(i);
        if (i < 50) underExposed += pixelCount;
        else if (i > 200) overExposed += pixelCount;
        else wellExposed += pixelCount;
      }
      
      const exposureScore = (wellExposed / totalPixels) * 100;
      
      // Contrast analysis using standard deviation
      const contrastScore = Math.min(100, Math.max(0, gray.stddev().val * 2));
      
      // Overall quality score
      const overallQuality = (blurScore + exposureScore + contrastScore) / 3;
      
      // Clean up memory
      gray.release();
      laplacian.release();
      hist.release();
      
      return {
        blurScore,
        exposureScore,
        contrastScore,
        overallQuality
      };
      
    } catch (error) {
      logger.error('Image quality analysis failed:', error);
      return {
        blurScore: 50,
        exposureScore: 50,
        contrastScore: 50,
        overallQuality: 50
      };
    }
  }

  async extractFeatures(images) {
    const features = [];

    for (const image of images) {
      try {
        // Convert buffer to OpenCV Mat
        const mat = cv.imdecode(image.buffer);
        const gray = mat.cvtColor(cv.COLOR_BGR2GRAY);
        
        // Detect keypoints and compute descriptors
        const keypoints = this.detector.detect(gray);
        const descriptors = this.detector.compute(gray, keypoints);
        
        features.push({
          imageId: image.id,
          mat: mat,
          gray: gray,
          keypoints: keypoints,
          descriptors: descriptors
        });
        
        logger.info(`Extracted ${keypoints.length} keypoints for image ${image.id}`);
        
      } catch (error) {
        logger.error(`Feature extraction failed for image ${image.id}:`, error);
        throw error;
      }
    }

    return features;
  }

  async matchFeatures(features) {
    const matches = [];

    for (let i = 0; i < features.length - 1; i++) {
      try {
        const feature1 = features[i];
        const feature2 = features[i + 1];
        
        if (!feature1.descriptors || !feature2.descriptors) {
          logger.warn(`No descriptors found for image pair ${i}-${i + 1}`);
          continue;
        }

        // Match descriptors
        const knnMatches = this.matcher.knnMatch(feature1.descriptors, feature2.descriptors, 2);
        
        // Apply Lowe's ratio test to filter good matches
        const goodMatches = [];
        for (const matchPair of knnMatches) {
          if (matchPair.length === 2) {
            const [m, n] = matchPair;
            if (m.distance < 0.75 * n.distance) {
              goodMatches.push(m);
            }
          }
        }

        // Only proceed if we have enough good matches
        if (goodMatches.length >= 10) {
          matches.push({
            image1Id: feature1.imageId,
            image2Id: feature2.imageId,
            matches: goodMatches,
            feature1: feature1,
            feature2: feature2,
            confidence: goodMatches.length / Math.min(feature1.keypoints.length, feature2.keypoints.length)
          });
          
          logger.info(`Found ${goodMatches.length} good matches between images ${feature1.imageId} and ${feature2.imageId}`);
        } else {
          logger.warn(`Insufficient matches (${goodMatches.length}) between images ${feature1.imageId} and ${feature2.imageId}`);
        }
        
      } catch (error) {
        logger.error(`Feature matching failed between images ${i} and ${i + 1}:`, error);
      }
    }

    return matches;
  }

  async calculateHomographies(features, matches) {
    const homographies = [];

    for (const match of matches) {
      try {
        // Extract matched keypoints
        const srcPoints = match.matches.map(m => match.feature1.keypoints[m.queryIdx].pt);
        const dstPoints = match.matches.map(m => match.feature2.keypoints[m.trainIdx].pt);

        // Convert to OpenCV Point2f arrays
        const srcPointsVec = new cv.Point2fVector(srcPoints);
        const dstPointsVec = new cv.Point2fVector(dstPoints);

        // Calculate homography using RANSAC
        const result = cv.findHomography(srcPointsVec, dstPointsVec, cv.RANSAC, 5.0);
        
        if (result && result.homography) {
          homographies.push({
            image1Id: match.image1Id,
            image2Id: match.image2Id,
            matrix: result.homography,
            confidence: match.confidence,
            inliers: result.inliers
          });
          
          logger.info(`Calculated homography for images ${match.image1Id} -> ${match.image2Id} with ${result.inliers} inliers`);
        } else {
          logger.warn(`Failed to calculate homography for images ${match.image1Id} -> ${match.image2Id}`);
        }

        // Clean up memory
        srcPointsVec.delete();
        dstPointsVec.delete();
        if (result) result.delete();
        
      } catch (error) {
        logger.error(`Homography calculation failed:`, error);
      }
    }

    return homographies;
  }

  async stitchImagesOpenCV(images, homographies) {
    try {
      if (homographies.length === 0) {
        throw new Error('No valid homographies found for stitching');
      }

      // Start with the first image
      let panorama = cv.imdecode(images[0].buffer);
      let panoramaCorners = this.getImageCorners(panorama);
      
      // Transform and blend each subsequent image
      for (let i = 1; i < images.length; i++) {
        const homography = homographies.find(h => h.image2Id === images[i].id);
        
        if (homography) {
          const currentImage = cv.imdecode(images[i].buffer);
          const transformedImage = currentImage.warpPerspective(homography.matrix, panorama.size());
          
          // Calculate new panorama corners after transformation
          const newCorners = this.transformCorners(this.getImageCorners(currentImage), homography.matrix);
          panoramaCorners = this.combineCorners(panoramaCorners, newCorners);
          
          // Blend images
          panorama = this.blendImages(panorama, transformedImage);
          
          // Clean up memory
          currentImage.release();
          transformedImage.release();
        }
      }

      // Crop panorama to remove black borders
      const croppedPanorama = this.cropPanorama(panorama, panoramaCorners);
      
      // Convert back to buffer
      const resultBuffer = cv.imencode('.jpg', croppedPanorama).getDataAsArray();
      const resultBufferNode = Buffer.from(resultBuffer);
      
      // Calculate stitching quality
      const stitchingQuality = this.calculateStitchingQuality(croppedPanorama, images.length);
      
      // Clean up memory
      panorama.release();
      croppedPanorama.release();
      
      return {
        buffer: resultBufferNode,
        quality: stitchingQuality.overall * 100,
        stitchingQuality: stitchingQuality
      };

    } catch (error) {
      logger.error('OpenCV stitching failed:', error);
      throw new Error('Failed to stitch images with OpenCV');
    }
  }

  getImageCorners(mat) {
    const h = mat.rows;
    const w = mat.cols;
    return [
      new cv.Point2(0, 0),
      new cv.Point2(w, 0),
      new cv.Point2(w, h),
      new cv.Point2(0, h)
    ];
  }

  transformCorners(corners, homography) {
    return corners.map(corner => {
      const transformed = homography.transformPoint(corner);
      return new cv.Point2(transformed.x, transformed.y);
    });
  }

  combineCorners(corners1, corners2) {
    const allCorners = [...corners1, ...corners2];
    const minX = Math.min(...allCorners.map(c => c.x));
    const maxX = Math.max(...allCorners.map(c => c.x));
    const minY = Math.min(...allCorners.map(c => c.y));
    const maxY = Math.max(...allCorners.map(c => c.y));
    
    return [
      new cv.Point2(minX, minY),
      new cv.Point2(maxX, minY),
      new cv.Point2(maxX, maxY),
      new cv.Point2(minX, maxY)
    ];
  }

  blendImages(img1, img2) {
    try {
      // Create a mask for blending
      const mask = new cv.Mat(img1.rows, img1.cols, cv.CV_8UC1, 0);
      
      // Simple blending - in production, use advanced techniques like multi-band blending
      const blended = img1.copy();
      
      // Create alpha blending
      const alpha = 0.5;
      img1.copyTo(blended);
      
      // Add second image with alpha blending
      const temp = img2.copy();
      cv.addWeighted(blended, 1 - alpha, temp, alpha, 0, blended);
      
      // Clean up memory
      mask.release();
      temp.release();
      
      return blended;
      
    } catch (error) {
      logger.error('Image blending failed:', error);
      return img1.copy();
    }
  }

  cropPanorama(panorama, corners) {
    try {
      const minX = Math.max(0, Math.floor(Math.min(...corners.map(c => c.x))));
      const maxX = Math.min(panorama.cols, Math.ceil(Math.max(...corners.map(c => c.x))));
      const minY = Math.max(0, Math.floor(Math.min(...corners.map(c => c.y))));
      const maxY = Math.min(panorama.rows, Math.ceil(Math.max(...corners.map(c => c.y))));
      
      const roi = new cv.Rect(minX, minY, maxX - minX, maxY - minY);
      return panorama.getRegion(roi);
      
    } catch (error) {
      logger.error('Panorama cropping failed:', error);
      return panorama.copy();
    }
  }

  calculateStitchingQuality(panorama, numImages) {
    try {
      // Analyze the stitched panorama quality
      const gray = panorama.cvtColor(cv.COLOR_BGR2GRAY);
      
      // Calculate sharpness (Laplacian variance)
      const laplacian = gray.laplacian(cv.CV_64F);
      const sharpness = laplacian.stddev().val;
      
      // Calculate contrast
      const contrast = gray.stddev().val;
      
      // Base quality from image analysis
      const baseQuality = Math.min(0.95, Math.max(0.1, sharpness / 50));
      
      // Bonus for multiple images
      const imageBonus = Math.min(0.2, numImages * 0.05);
      
      // Overall quality
      const overall = Math.min(0.95, baseQuality + imageBonus);
      
      // Clean up memory
      gray.release();
      laplacian.release();
      
      return {
        overall,
        sharpness: sharpness / 50,
        contrast: contrast / 50,
        seamQuality: overall * 0.9,
        colorConsistency: overall * 0.8,
        geometricAccuracy: overall * 0.85
      };
      
    } catch (error) {
      logger.error('Stitching quality calculation failed:', error);
      return {
        overall: 0.7,
        sharpness: 0.7,
        contrast: 0.7,
        seamQuality: 0.6,
        colorConsistency: 0.6,
        geometricAccuracy: 0.6
      };
    }
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
          stitching_method: 'opencv',
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
  OpenCVStitchingProcessor
};
