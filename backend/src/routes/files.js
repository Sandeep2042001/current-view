const express = require('express');
const { getMinioClient } = require('../config/minio');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/files/*
 * Serve files from MinIO storage
 */
router.get('/*', async (req, res) => {
  try {
    const filePath = req.params[0]; // Get the full path after /api/files/
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    logger.info(`Serving file: ${filePath}`);

    const minioClient = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || 'interactive360';

    // Get file from MinIO
    const fileStream = await minioClient.getObject(bucket, filePath);

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the file
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error(`Error streaming file ${filePath}:`, error);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });

  } catch (error) {
    logger.error('Error serving file:', error);
    if (!res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  }
});

module.exports = router;
