const express = require('express');
const { authMiddleware } = require('../middleware/auth');

// Import all route modules
const authRoutes = require('./auth');
const projectRoutes = require('./projects');
const uploadModule = require('./upload');
const uploadRoutes = uploadModule.router;
const imageDataRoute = uploadModule.imageDataRoute;
const processingRoutes = require('./processing');
const adminRoutes = require('./admin');
const measurementRoutes = require('./measurements');
const annotationRoutes = require('./annotations');

const router = express.Router();

// Public routes (no authentication required)
router.use('/auth', authRoutes);

// Public image serving (no authentication required)
router.use('/upload/image-data', imageDataRoute);

// Public stitched image serving (no authentication required)
const stitchedImageRoute = express.Router();
stitchedImageRoute.get('/:imagePath', async (req, res) => {
  try {
    const imagePath = decodeURIComponent(req.params.imagePath);
    const { getMinioClient } = require('../config/minio');
    
    // Get image data from MinIO
    const minioClient = getMinioClient();
    const imageStream = await minioClient.getObject(
      process.env.MINIO_BUCKET || 'interactive360',
      imagePath
    );

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600'
    });

    // Stream the image data
    imageStream.pipe(res);
  } catch (error) {
    console.error('Error serving stitched image:', error);
    res.status(404).json({ error: 'Stitched image not found' });
  }
});

router.use('/upload/stitched-image', stitchedImageRoute);

// Protected routes (authentication required)
router.use('/projects', authMiddleware, projectRoutes);
router.use('/upload', authMiddleware, uploadRoutes);
router.use('/processing', authMiddleware, processingRoutes);
router.use('/admin', authMiddleware, adminRoutes);
router.use('/measurements', authMiddleware, measurementRoutes);
router.use('/annotations', authMiddleware, annotationRoutes);

// Health check endpoint (public)
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Interactive 360° Platform API',
    version: process.env.API_VERSION || '1.0.0',
    description: 'RESTful API for 360° image processing, measurements, and annotations',
    endpoints: {
      authentication: '/api/auth',
      projects: '/api/projects',
      upload: '/api/upload',
      processing: '/api/processing',
      measurements: '/api/measurements',
      annotations: '/api/annotations',
      admin: '/api/admin'
    },
    documentation: '/docs',
    health: '/api/health'
  });
});

module.exports = router;
