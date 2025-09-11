const express = require('express');
const { requireRole } = require('../middleware/auth');
const { db } = require('../config/database');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// All admin routes require admin role
router.use(requireRole(['admin', 'super_admin']));

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.raw(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM rooms) as total_rooms,
        (SELECT COUNT(*) FROM images) as total_images,
        (SELECT COUNT(*) FROM processing_jobs WHERE status = 'pending') as pending_jobs,
        (SELECT COUNT(*) FROM processing_jobs WHERE status = 'processing') as processing_jobs,
        (SELECT COUNT(*) FROM processing_jobs WHERE status = 'completed') as completed_jobs,
        (SELECT COUNT(*) FROM processing_jobs WHERE status = 'failed') as failed_jobs
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'last_login', 'created_at')
      .orderBy('created_at', 'desc');

    if (search) {
      query = query.where(function() {
        this.where('email', 'ilike', `%${search}%`)
          .orWhere('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`);
      });
    }

    const users = await query.limit(limit).offset(offset);
    const total = await db('users').count('* as count').first();

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = db('projects')
      .join('users', 'projects.user_id', 'users.id')
      .select(
        'projects.*',
        'users.email as user_email',
        'users.first_name as user_first_name',
        'users.last_name as user_last_name'
      )
      .orderBy('projects.created_at', 'desc');

    if (status) {
      query = query.where('projects.status', status);
    }

    const projects = await query.limit(limit).offset(offset);
    const total = await db('projects').count('* as count').first();

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get processing jobs
router.get('/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', type = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = db('processing_jobs')
      .join('projects', 'processing_jobs.project_id', 'projects.id')
      .join('users', 'projects.user_id', 'users.id')
      .select(
        'processing_jobs.*',
        'projects.name as project_name',
        'users.email as user_email'
      )
      .orderBy('processing_jobs.created_at', 'desc');

    if (status) {
      query = query.where('processing_jobs.status', status);
    }

    if (type) {
      query = query.where('processing_jobs.type', type);
    }

    const jobs = await query.limit(limit).offset(offset);
    const total = await db('processing_jobs').count('* as count').first();

    res.json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get system health
router.get('/health', async (req, res) => {
  try {
    const health = {
      database: 'healthy',
      redis: 'healthy',
      minio: 'healthy',
      timestamp: new Date().toISOString()
    };

    // Check database
    try {
      await db.raw('SELECT 1');
    } catch (error) {
      health.database = 'unhealthy';
    }

    // Check Redis
    try {
      const redisClient = getRedisClient();
      await redisClient.ping();
    } catch (error) {
      health.redis = 'unhealthy';
    }

    // Check MinIO
    try {
      const { getMinioClient } = require('../config/minio');
      const minioClient = getMinioClient();
      await minioClient.bucketExists(process.env.MINIO_BUCKET || 'interactive360');
    } catch (error) {
      health.minio = 'unhealthy';
    }

    const overallHealth = Object.values(health).every(status => status === 'healthy') ? 'healthy' : 'unhealthy';

    res.json({
      ...health,
      overall: overallHealth
    });
  } catch (error) {
    logger.error('Error checking system health:', error);
    res.status(500).json({ error: 'Failed to check system health' });
  }
});

// Get queue status
router.get('/queue', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    
    const queueLength = await redisClient.lLen('cv-processing-queue');
    const queueItems = await redisClient.lRange('cv-processing-queue', 0, 9);

    res.json({
      queueLength,
      recentItems: queueItems.map(item => JSON.parse(item))
    });
  } catch (error) {
    logger.error('Error fetching queue status:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// Clear failed jobs
router.post('/jobs/clear-failed', async (req, res) => {
  try {
    const result = await db('processing_jobs')
      .where({ status: 'failed' })
      .del();

    logger.info(`Cleared ${result} failed jobs by admin ${req.user.id}`);

    res.json({
      message: `Cleared ${result} failed jobs`,
      count: result
    });
  } catch (error) {
    logger.error('Error clearing failed jobs:', error);
    res.status(500).json({ error: 'Failed to clear failed jobs' });
  }
});

module.exports = router;
