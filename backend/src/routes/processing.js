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

// Start building-level stitching process
router.post('/3d-reconstruct/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room with images
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .select('rooms.*', 'projects.name as project_name')
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get all images for this room
    const images = await db('images')
      .where({ room_id: roomId })
      .select('id');

    if (images.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 images for 3D reconstruction' });
    }

    // Create processing job
    const [job] = await db('processing_jobs')
      .insert({
        project_id: room.project_id,
        type: '3d_reconstruction',
        status: 'pending',
        input_data: {
          room_id: roomId,
          image_ids: images.map(img => img.id)
        }
      })
      .returning('*');

    // Add to Redis queue
    const redisClient = getRedisClient();
    await redisClient.lPush('cv-processing-queue', JSON.stringify({
      jobId: job.id,
      type: '3d_reconstruction',
      data: job.input_data
    }));

    logger.info(`3D reconstruction job created for room ${roomId}`);

    res.json({
      success: true,
      jobId: job.id,
      message: `3D reconstruction started for ${images.length} images`
    });

  } catch (error) {
    logger.error('Error starting 3D reconstruction:', error);
    res.status(500).json({ error: 'Failed to start 3D reconstruction' });
  }
});

// Batch process all rooms in a project
router.post('/batch-process/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all rooms with images
    const rooms = await db('rooms')
      .where({ project_id: projectId })
      .select('id', 'name');

    if (rooms.length === 0) {
      return res.status(400).json({ error: 'No rooms found in project' });
    }

    const jobsCreated = [];
    const redisClient = getRedisClient();

    // Create processing job for each room
    for (const room of rooms) {
      // Get images for this room
      const images = await db('images')
        .where({ room_id: room.id })
        .select('id');

      if (images.length === 0) {
        logger.info(`Skipping room ${room.name} - no images`);
        continue;
      }

      // Create stitching job
      const jobData = {
        room_id: room.id,
        image_ids: images.map(img => img.id)
      };

      const [job] = await db('processing_jobs')
        .insert({
          project_id: projectId,
          user_id: req.user.id,
          type: 'stitching',
          status: 'pending',
          input_data: jobData
        })
        .returning('*');

      // Add to Redis queue
      await redisClient.lPush('cv-processing-queue', JSON.stringify({
        jobId: job.id,
        type: 'stitching',
        data: jobData
      }));

      jobsCreated.push({
        room_id: room.id,
        room_name: room.name,
        job_id: job.id,
        image_count: images.length
      });

      logger.info(`Created stitching job for room ${room.name} (${images.length} images)`);
    }

    res.json({
      success: true,
      message: `Started processing ${jobsCreated.length} rooms`,
      jobs: jobsCreated
    });

  } catch (error) {
    logger.error('Error starting batch processing:', error);
    res.status(500).json({ error: 'Failed to start batch processing' });
  }
});

router.post('/building-stitch/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists and belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if all rooms are completed
    const rooms = await db('rooms')
      .where({ 
        project_id: projectId,
        status: 'completed' 
      });

    if (rooms.length < 1) {
      return res.status(400).json({ 
        error: 'At least 1 completed room required for building stitching' 
      });
    }

    // Create building stitching job
    const [job] = await db('processing_jobs')
      .insert({
        project_id: projectId,
        type: 'building_stitching',
        input_data: {
          project_id: projectId
        },
        status: 'pending'
      })
      .returning('*');

    // Queue job for processing
    const redisClient = getRedisClient();
    await redisClient.lPush('cv-processing-queue', JSON.stringify({
      jobId: job.id,
      type: 'building_stitching',
      data: job.input_data
    }));

    logger.info(`Building stitching job queued for project ${projectId}`);

    res.json({
      success: true,
      jobId: job.id,
      message: `Building stitching started for ${rooms.length} rooms`
    });

  } catch (error) {
    logger.error('Error starting building stitching:', error);
    res.status(500).json({ error: 'Failed to start building stitching' });
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
