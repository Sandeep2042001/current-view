const express = require('express');
const authMiddleware = require('../middleware/auth');

// Import all route modules
const authRoutes = require('./auth');
const projectRoutes = require('./projects');
const uploadRoutes = require('./upload');
const processingRoutes = require('./processing');
const adminRoutes = require('./admin');
const measurementRoutes = require('./measurements');
const annotationRoutes = require('./annotations');

const router = express.Router();

// Public routes (no authentication required)
router.use('/auth', authRoutes);

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
