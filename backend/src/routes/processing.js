const express = require('express');
const { getRedisClient } = require('../config/redis');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Start stitching process for a room
router.post('/stitch/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get images for the room
    const images = await db('images')
      .where({ room_id: roomId })
      .orderBy('created_at', 'asc');

    if (images.length < 2) {
      return res.status(400).json({ error: 'At least 2 images required for stitching' });
    }

    // Create processing job
    const [job] = await db('processing_jobs')
      .insert({
        project_id: room.project_id,
        type: 'stitching',
        input_data: {
          room_id: roomId,
          image_ids: images.map(img => img.id)
        },
        status: 'pending'
      })
      .returning('*');

    // Queue job for processing
    const redisClient = getRedisClient();
    await redisClient.lPush('cv-processing-queue', JSON.stringify({
      jobId: job.id,
      type: 'stitching',
      data: job.input_data
    }));

    // Update room status
    await db('rooms')
      .where({ id: roomId })
      .update({ status: 'processing' });

    logger.info(`Stitching job queued: ${job.id} for room ${roomId}`);

    res.json({
      message: 'Stitching process started',
      jobId: job.id,
      status: 'pending'
    });
  } catch (error) {
    logger.error('Error starting stitching process:', error);
    res.status(500).json({ error: 'Failed to start stitching process' });
  }
});

// Start 3D reconstruction process
router.post('/reconstruct/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists and belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all stitched images from project
    const rooms = await db('rooms')
      .where({ project_id: projectId, status: 'completed' });

    if (rooms.length === 0) {
      return res.status(400).json({ error: 'No completed rooms found for 3D reconstruction' });
    }

    // Create processing job
    const [job] = await db('processing_jobs')
      .insert({
        project_id: projectId,
        type: '3d_reconstruction',
        input_data: {
          room_ids: rooms.map(room => room.id)
        },
        status: 'pending'
      })
      .returning('*');

    // Queue job for processing
    const redisClient = getRedisClient();
    await redisClient.lPush('cv-processing-queue', JSON.stringify({
      jobId: job.id,
      type: '3d_reconstruction',
      data: job.input_data
    }));

    logger.info(`3D reconstruction job queued: ${job.id} for project ${projectId}`);

    res.json({
      message: '3D reconstruction process started',
      jobId: job.id,
      status: 'pending'
    });
  } catch (error) {
    logger.error('Error starting 3D reconstruction:', error);
    res.status(500).json({ error: 'Failed to start 3D reconstruction' });
  }
});

// Generate hotspots for a room
router.post('/hotspots/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Create processing job
    const [job] = await db('processing_jobs')
      .insert({
        project_id: room.project_id,
        type: 'hotspot_generation',
        input_data: {
          room_id: roomId
        },
        status: 'pending'
      })
      .returning('*');

    // Queue job for processing
    const redisClient = getRedisClient();
    await redisClient.lPush('cv-processing-queue', JSON.stringify({
      jobId: job.id,
      type: 'hotspot_generation',
      data: job.input_data
    }));

    logger.info(`Hotspot generation job queued: ${job.id} for room ${roomId}`);

    res.json({
      message: 'Hotspot generation process started',
      jobId: job.id,
      status: 'pending'
    });
  } catch (error) {
    logger.error('Error starting hotspot generation:', error);
    res.status(500).json({ error: 'Failed to start hotspot generation' });
  }
});

// Get job status
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await db('processing_jobs')
      .join('projects', 'processing_jobs.project_id', 'projects.id')
      .where({ 'processing_jobs.id': jobId, 'projects.user_id': req.user.id })
      .first();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// Get all jobs for a project
router.get('/jobs/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const jobs = await db('processing_jobs')
      .where({ project_id: projectId })
      .orderBy('created_at', 'desc');

    res.json(jobs);
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

module.exports = router;
