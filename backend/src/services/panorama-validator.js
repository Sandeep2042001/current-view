const sharp = require('sharp');
const logger = require('../utils/logger');

class PanoramaValidator {
  constructor() {
    // Standard equirectangular aspect ratio is 2:1
    this.EXPECTED_ASPECT_RATIO = 2.0;
    this.ASPECT_RATIO_TOLERANCE = 0.1;
    
    // Recommended resolutions
    this.RECOMMENDED_RESOLUTIONS = [
      { width: 8192, height: 4096, name: '8K' },
      { width: 7680, height: 3840, name: '8K UHD' },
      { width: 4096, height: 2048, name: '4K' },
      { width: 3840, height: 1920, name: '4K UHD' },
      { width: 2048, height: 1024, name: '2K' },
      { width: 1920, height: 960, name: 'HD+' }
    ];
    
    this.MIN_RESOLUTION = { width: 1024, height: 512 };
  }

  /**
   * Validate if an image is a proper 360° equirectangular panorama
   */
  async validatePanorama(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation
        },
        quality: {
          resolution: 'unknown',
          aspectRatio: 0,
          isEquirectangular: false,
          recommendedUpgrade: null
        }
      };

      // Check aspect ratio
      const aspectRatio = metadata.width / metadata.height;
      validation.quality.aspectRatio = aspectRatio;
      
      const ratioDiff = Math.abs(aspectRatio - this.EXPECTED_ASPECT_RATIO);
      validation.quality.isEquirectangular = ratioDiff <= this.ASPECT_RATIO_TOLERANCE;

      if (!validation.quality.isEquirectangular) {
        validation.errors.push(
          `Image aspect ratio ${aspectRatio.toFixed(2)}:1 is not standard for 360° panoramas (expected 2:1)`
        );
        validation.isValid = false;
      }

      // Check minimum resolution
      if (metadata.width < this.MIN_RESOLUTION.width || metadata.height < this.MIN_RESOLUTION.height) {
        validation.errors.push(
          `Image resolution ${metadata.width}x${metadata.height} is below minimum ` +
          `${this.MIN_RESOLUTION.width}x${this.MIN_RESOLUTION.height}`
        );
        validation.isValid = false;
      }

      // Determine quality level
      const resolution = this.getResolutionQuality(metadata.width, metadata.height);
      validation.quality.resolution = resolution.name;
      validation.quality.recommendedUpgrade = resolution.upgrade;

      // Check for alpha channel (not needed for panoramas)
      if (metadata.hasAlpha) {
        validation.warnings.push('Image has an alpha channel which is not needed for panoramas');
      }

      // Check orientation
      if (metadata.orientation && metadata.orientation !== 1) {
        validation.warnings.push('Image has EXIF orientation data that may cause display issues');
      }

      logger.info('Panorama validation completed:', {
        isValid: validation.isValid,
        resolution: `${metadata.width}x${metadata.height}`,
        aspectRatio: aspectRatio.toFixed(2)
      });

      return validation;

    } catch (error) {
      logger.error('Error validating panorama:', error);
      throw error;
    }
  }

  /**
   * Get resolution quality tier
   */
  getResolutionQuality(width, height) {
    for (const res of this.RECOMMENDED_RESOLUTIONS) {
      if (width >= res.width && height >= res.height) {
        return { name: res.name, upgrade: null };
      }
    }

    // Find next recommended upgrade
    const upgrade = this.RECOMMENDED_RESOLUTIONS
      .reverse()
      .find(res => res.width > width || res.height > height);

    return {
      name: 'Below HD',
      upgrade: upgrade ? `${upgrade.name} (${upgrade.width}x${upgrade.height})` : null
    };
  }

  /**
   * Process and optimize panorama for web delivery
   */
  async processPanorama(imageBuffer, options = {}) {
    try {
      const {
        quality = 90,
        progressive = true,
        stripMetadata = true,
        generateThumbnail = true,
        generatePreview = true,
        maxWidth = 8192
      } = options;

      const results = {
        original: null,
        optimized: null,
        thumbnail: null,
        preview: null,
        stats: {
          originalSize: imageBuffer.length,
          optimizedSize: 0,
          compressionRatio: 0
        }
      };

      const metadata = await sharp(imageBuffer).metadata();
      results.original = metadata;

      // Create optimized version
      let pipeline = sharp(imageBuffer);

      // Resize if too large
      if (metadata.width > maxWidth) {
        const scaleFactor = maxWidth / metadata.width;
        pipeline = pipeline.resize({
          width: maxWidth,
          height: Math.round(metadata.height * scaleFactor),
          fit: 'contain'
        });
      }

      // Apply optimizations
      if (stripMetadata) {
        pipeline = pipeline.withMetadata({ orientation: 1 });
      }

      // Convert to JPEG with progressive encoding
      const optimizedBuffer = await pipeline
        .jpeg({
          quality,
          progressive,
          mozjpeg: true
        })
        .toBuffer();

      results.optimized = await sharp(optimizedBuffer).metadata();
      results.stats.optimizedSize = optimizedBuffer.length;
      results.stats.compressionRatio = ((1 - optimizedBuffer.length / imageBuffer.length) * 100).toFixed(2);

      // Generate thumbnail (for project cards)
      if (generateThumbnail) {
        results.thumbnail = await sharp(imageBuffer)
          .resize(400, 200, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
      }

      // Generate preview (for faster loading)
      if (generatePreview) {
        results.preview = await sharp(imageBuffer)
          .resize(2048, 1024, { fit: 'contain' })
          .jpeg({ quality: 75 })
          .toBuffer();
      }

      logger.info('Panorama processing completed:', {
        originalSize: `${(results.stats.originalSize / 1024 / 1024).toFixed(2)} MB`,
        optimizedSize: `${(results.stats.optimizedSize / 1024 / 1024).toFixed(2)} MB`,
        compressionRatio: `${results.stats.compressionRatio}%`
      });

      return {
        ...results,
        optimizedBuffer,
        thumbnailBuffer: results.thumbnail,
        previewBuffer: results.preview
      };

    } catch (error) {
      logger.error('Error processing panorama:', error);
      throw error;
    }
  }

  /**
   * Extract EXIF data for positioning hints
   */
  async extractMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: metadata.exif,
        icc: metadata.icc
      };
    } catch (error) {
      logger.error('Error extracting metadata:', error);
      return null;
    }
  }

  /**
   * Generate quality report for the panorama
   */
  async generateQualityReport(imageBuffer) {
    try {
      const validation = await this.validatePanorama(imageBuffer);
      const stats = await sharp(imageBuffer).stats();
      
      // Calculate sharpness (using channel statistics)
      const sharpnessScore = this.calculateSharpness(stats);
      
      // Calculate exposure quality
      const exposureScore = this.calculateExposure(stats);

      return {
        validation,
        sharpness: {
          score: sharpnessScore,
          rating: this.getRating(sharpnessScore)
        },
        exposure: {
          score: exposureScore,
          rating: this.getRating(exposureScore)
        },
        overallScore: (sharpnessScore + exposureScore) / 2,
        overallRating: this.getRating((sharpnessScore + exposureScore) / 2)
      };

    } catch (error) {
      logger.error('Error generating quality report:', error);
      throw error;
    }
  }

  calculateSharpness(stats) {
    // Simple sharpness estimation based on channel statistics
    const channelVariances = stats.channels.map(ch => ch.stdev || 0);
    const avgVariance = channelVariances.reduce((sum, v) => sum + v, 0) / channelVariances.length;
    
    // Normalize to 0-100 scale (assuming max std dev of 50)
    return Math.min(100, (avgVariance / 50) * 100);
  }

  calculateExposure(stats) {
    // Check if exposure is balanced (mean should be around 127-128 for 8-bit)
    const channelMeans = stats.channels.map(ch => ch.mean || 0);
    const avgMean = channelMeans.reduce((sum, m) => sum + m, 0) / channelMeans.length;
    
    // Calculate how close to optimal (127.5 for 8-bit)
    const optimal = 127.5;
    const deviation = Math.abs(avgMean - optimal);
    
    // Normalize to 0-100 scale (deviation of 0 = 100, deviation of 50 = 0)
    return Math.max(0, 100 - (deviation / optimal) * 100);
  }

  getRating(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'bad';
  }
}

module.exports = new PanoramaValidator();
