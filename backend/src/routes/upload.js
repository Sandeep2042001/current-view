const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload 360° image
router.post('/image/:roomId', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { roomId } = req.params;
    const { metadata } = req.body;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const originalFilename = req.file.originalname;
    const fileExtension = originalFilename.split('.').pop();
    const filename = `${fileId}.${fileExtension}`;
    const storagePath = `projects/${room.project_id}/rooms/${roomId}/images/${filename}`;

    // Process image with Sharp
    const processedImage = await sharp(req.file.buffer)
      .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Upload to MinIO
    const minioClient = getMinioClient();
    await minioClient.putObject(
      process.env.MINIO_BUCKET || 'interactive360',
      storagePath,
      processedImage,
      {
        'Content-Type': req.file.mimetype,
        'Content-Length': processedImage.length
      }
    );

    // Parse metadata if provided
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        logger.warn('Invalid metadata JSON provided');
      }
    }

    // Save image record to database
    const [image] = await db('images')
      .insert({
        room_id: roomId,
        filename: filename,
        original_filename: originalFilename,
        mime_type: req.file.mimetype,
        file_size: processedImage.length,
        storage_path: storagePath,
        metadata: parsedMetadata,
        processing_status: {
          uploaded: true,
          processed: false,
          stitched: false
        }
      })
      .returning('*');

    logger.info(`Image uploaded: ${filename} for room ${roomId}`);

    res.status(201).json({
      message: 'Image uploaded successfully',
      image
    });
  } catch (error) {
    logger.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get image URL
router.get('/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db('images')
      .join('rooms', 'images.room_id', 'rooms.id')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'images.id': imageId, 'projects.user_id': req.user.id })
      .first();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Return API URL instead of presigned URL to avoid CORS issues
    const apiUrl = `http://localhost:3000/api/upload/image-data/${imageId}`;
    console.log('Returning image URL:', apiUrl);
    console.log('Image ID:', imageId);

    res.json({
      ...image,
      url: apiUrl
    });
  } catch (error) {
    logger.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});


// Delete image
router.delete('/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db('images')
      .join('rooms', 'images.room_id', 'rooms.id')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'images.id': imageId, 'projects.user_id': req.user.id })
      .first();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from MinIO
    const minioClient = getMinioClient();
    await minioClient.removeObject(
      process.env.MINIO_BUCKET || 'interactive360',
      image.storage_path
    );

    // Delete from database
    await db('images').where({ id: imageId }).del();

    logger.info(`Image deleted: ${image.filename}`);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Get upload progress for room
router.get('/progress/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const images = await db('images')
      .where({ room_id: roomId })
      .orderBy('created_at', 'asc');

    const progress = {
      totalImages: images.length,
      uploadedImages: images.filter(img => img.processing_status.uploaded).length,
      processedImages: images.filter(img => img.processing_status.processed).length,
      stitchedImages: images.filter(img => img.processing_status.stitched).length,
      images: images.map(img => ({
        id: img.id,
        filename: img.filename,
        status: img.processing_status,
        uploadedAt: img.created_at
      }))
    };

    res.json(progress);
  } catch (error) {
    logger.error('Error fetching upload progress:', error);
    res.status(500).json({ error: 'Failed to fetch upload progress' });
  }
});

// Export the image data route separately for public access
const imageDataRoute = express.Router();
imageDataRoute.get('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    // Get image from database (no user authentication required for serving images)
    const image = await db('images')
      .where({ 'id': imageId })
      .first();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get image data from MinIO
    const minioClient = getMinioClient();
    const imageStream = await minioClient.getObject(
      process.env.MINIO_BUCKET || 'interactive360',
      image.storage_path
    );

    // Set appropriate headers
    res.set({
      'Content-Type': image.mime_type,
      'Content-Length': image.file_size,
      'Cache-Control': 'public, max-age=3600'
    });

    // Stream the image data
    imageStream.pipe(res);
  } catch (error) {
    logger.error('Error serving image data:', error);
    res.status(500).json({ error: 'Failed to serve image data' });
  }
});

module.exports = {
  router,
  imageDataRoute
};
