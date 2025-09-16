const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const projectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('').optional(),
  settings: Joi.object().optional()
});

// Get all projects for user
router.get('/', async (req, res) => {
  try {
    const projects = await db('projects')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc');

    // Get room count for each project and fix date field names
    for (let project of projects) {
      const roomCount = await db('rooms')
        .where({ project_id: project.id })
        .count('* as count')
        .first();
      
      project.room_count = parseInt(roomCount.count);
      project.createdAt = project.created_at;
      project.updatedAt = project.updated_at;
    }

    res.json(projects);
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await db('projects')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get rooms with images and hotspots
    const rooms = await db('rooms')
      .where({ project_id: project.id })
      .orderBy('created_at', 'asc');

    // Get images for each room
    for (let room of rooms) {
      room.images = await db('images')
        .where({ room_id: room.id })
        .orderBy('created_at', 'asc');
      
      room.hotspots = await db('hotspots')
        .where({ room_id: room.id })
        .orderBy('created_at', 'asc');
    }

    project.rooms = rooms;
    project.createdAt = project.created_at;
    project.updatedAt = project.updated_at;

    res.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [project] = await db('projects')
      .insert({
        user_id: req.user.id,
        name: value.name,
        description: value.description || '',
        settings: value.settings || {}
      })
      .returning('*');

    logger.info(`Project created: ${project.id} by user ${req.user.id}`);

    res.status(201).json(project);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const project = await db('projects')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [updatedProject] = await db('projects')
      .where({ id: req.params.id })
      .update({
        name: value.name,
        description: value.description,
        settings: value.settings,
        updated_at: new Date()
      })
      .returning('*');

    logger.info(`Project updated: ${project.id} by user ${req.user.id}`);

    res.json(updatedProject);
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const project = await db('projects')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db('projects')
      .where({ id: req.params.id })
      .del();

    logger.info(`Project deleted: ${project.id} by user ${req.user.id}`);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Create room in project
router.post('/:id/rooms', async (req, res) => {
  try {
    const { name, description, position, rotation } = req.body;

    const project = await db('projects')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [room] = await db('rooms')
      .insert({
        project_id: req.params.id,
        name: name || 'Untitled Room',
        description: description || '',
        position: position || null,
        rotation: rotation || null
      })
      .returning('*');

    logger.info(`Room created: ${room.id} in project ${req.params.id}`);

    res.status(201).json(room);
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

module.exports = router;
