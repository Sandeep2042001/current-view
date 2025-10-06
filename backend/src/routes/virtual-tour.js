const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const hotspotSchema = Joi.object({
  target_room_id: Joi.string().uuid().required(),
  coordinates_x: Joi.number().required(),
  coordinates_y: Joi.number().required(),
  coordinates_z: Joi.number().required(),
  rotation_y: Joi.number().default(0),
  label: Joi.string().max(255).optional(),
  icon: Joi.string().default('arrow_forward'),
  color: Joi.string().default('#00ff00'),
  metadata: Joi.object().optional()
});

const bulkRoomUpdateSchema = Joi.object({
  rooms: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      initial_coordinates_x: Joi.number().optional(),
      initial_coordinates_y: Joi.number().optional(),
      initial_coordinates_z: Joi.number().optional(),
      rotation_y: Joi.number().optional(),
      is_starting_room: Joi.boolean().optional()
    })
  ).required()
});

/**
 * GET /api/virtual-tour/projects/:projectId/tour-data
 * Get complete tour data including rooms and their hotspots
 */
router.get('/projects/:projectId/tour-data', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all rooms for the project
    const rooms = await db('rooms')
      .where({ project_id: projectId })
      .orderBy('created_at', 'asc');

    // Get all hotspots for these rooms
    const roomIds = rooms.map(r => r.id);
    const hotspots = roomIds.length > 0 
      ? await db('navigation_hotspots')
          .whereIn('source_room_id', roomIds)
      : [];

    // Get all images for these rooms
    const images = roomIds.length > 0
      ? await db('images')
          .whereIn('room_id', roomIds)
      : [];

    // Organize data
    const roomsWithData = rooms.map(room => {
      const roomHotspots = hotspots.filter(h => h.source_room_id === room.id);
      const roomImages = images.filter(i => i.room_id === room.id);
      
      return {
        ...room,
        hotspots: roomHotspots,
        images: roomImages,
        // Include panorama path from metadata if available
        panorama_url: room.metadata?.panorama_path 
          ? `http://localhost:3000/api/files/${room.metadata.panorama_path}`
          : roomImages[0]?.storage_path 
            ? `http://localhost:3000/api/files/${roomImages[0].storage_path}`
            : null
      };
    });

    // Find starting room
    const startingRoom = roomsWithData.find(r => r.is_starting_room) || roomsWithData[0];

    res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description
      },
      rooms: roomsWithData,
      starting_room_id: startingRoom?.id || null,
      total_rooms: roomsWithData.length,
      total_hotspots: hotspots.length
    });

  } catch (error) {
    logger.error('Error fetching tour data:', error);
    res.status(500).json({ error: 'Failed to fetch tour data' });
  }
});

/**
 * POST /api/virtual-tour/rooms/:roomId/hotspots
 * Create a navigation hotspot
 */
router.post('/rooms/:roomId/hotspots', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { error, value } = hotspotSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify room ownership through project
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .select('rooms.*')
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Verify target room exists in the same project
    const targetRoom = await db('rooms')
      .where({ id: value.target_room_id, project_id: room.project_id })
      .first();

    if (!targetRoom) {
      return res.status(404).json({ error: 'Target room not found' });
    }

    // Create hotspot
    const [hotspot] = await db('navigation_hotspots')
      .insert({
        source_room_id: roomId,
        target_room_id: value.target_room_id,
        coordinates_x: value.coordinates_x,
        coordinates_y: value.coordinates_y,
        coordinates_z: value.coordinates_z,
        rotation_y: value.rotation_y || 0,
        label: value.label,
        icon: value.icon || 'arrow_forward',
        color: value.color || '#00ff00',
        metadata: value.metadata || null
      })
      .returning('*');

    logger.info(`Hotspot created from room ${roomId} to ${value.target_room_id}`);
    res.status(201).json(hotspot);

  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Hotspot already exists between these rooms' });
    }
    logger.error('Error creating hotspot:', error);
    res.status(500).json({ error: 'Failed to create hotspot' });
  }
});

/**
 * DELETE /api/virtual-tour/hotspots/:hotspotId
 * Delete a navigation hotspot
 */
router.delete('/hotspots/:hotspotId', async (req, res) => {
  try {
    const { hotspotId } = req.params;

    // Verify ownership through project
    const hotspot = await db('navigation_hotspots')
      .join('rooms', 'navigation_hotspots.source_room_id', 'rooms.id')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'navigation_hotspots.id': hotspotId, 'projects.user_id': req.user.id })
      .select('navigation_hotspots.*')
      .first();

    if (!hotspot) {
      return res.status(404).json({ error: 'Hotspot not found' });
    }

    await db('navigation_hotspots').where({ id: hotspotId }).del();

    logger.info(`Hotspot deleted: ${hotspotId}`);
    res.json({ message: 'Hotspot deleted successfully' });

  } catch (error) {
    logger.error('Error deleting hotspot:', error);
    res.status(500).json({ error: 'Failed to delete hotspot' });
  }
});

/**
 * PUT /api/virtual-tour/projects/:projectId/rooms/bulk-update
 * Update multiple rooms' spatial coordinates in bulk
 */
router.put('/projects/:projectId/rooms/bulk-update', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { error, value } = bulkRoomUpdateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If setting a new starting room, unset all others first
    const newStartingRoom = value.rooms.find(r => r.is_starting_room === true);
    if (newStartingRoom) {
      await db('rooms')
        .where({ project_id: projectId })
        .update({ is_starting_room: false });
    }

    // Update each room
    const updatePromises = value.rooms.map(async (roomUpdate) => {
      const updateData = {};
      
      if (roomUpdate.initial_coordinates_x !== undefined) updateData.initial_coordinates_x = roomUpdate.initial_coordinates_x;
      if (roomUpdate.initial_coordinates_y !== undefined) updateData.initial_coordinates_y = roomUpdate.initial_coordinates_y;
      if (roomUpdate.initial_coordinates_z !== undefined) updateData.initial_coordinates_z = roomUpdate.initial_coordinates_z;
      if (roomUpdate.rotation_y !== undefined) updateData.rotation_y = roomUpdate.rotation_y;
      if (roomUpdate.is_starting_room !== undefined) updateData.is_starting_room = roomUpdate.is_starting_room;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = db.fn.now();
        
        return db('rooms')
          .where({ id: roomUpdate.id, project_id: projectId })
          .update(updateData);
      }
      
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    logger.info(`Bulk updated ${value.rooms.length} rooms for project ${projectId}`);
    res.json({ 
      message: 'Rooms updated successfully', 
      updated_count: value.rooms.length 
    });

  } catch (error) {
    logger.error('Error bulk updating rooms:', error);
    res.status(500).json({ error: 'Failed to update rooms' });
  }
});

/**
 * PUT /api/virtual-tour/rooms/:roomId/starting-room
 * Set a room as the starting point of the tour
 */
router.put('/rooms/:roomId/starting-room', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Verify room ownership
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .select('rooms.*')
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Unset all other starting rooms in this project
    await db('rooms')
      .where({ project_id: room.project_id })
      .update({ is_starting_room: false });

    // Set this room as starting room
    await db('rooms')
      .where({ id: roomId })
      .update({ is_starting_room: true, updated_at: db.fn.now() });

    logger.info(`Set room ${roomId} as starting room`);
    res.json({ message: 'Starting room updated successfully' });

  } catch (error) {
    logger.error('Error setting starting room:', error);
    res.status(500).json({ error: 'Failed to set starting room' });
  }
});

/**
 * POST /api/virtual-tour/projects/:projectId/auto-generate-hotspots
 * Automatically generate hotspots between adjacent rooms
 */
router.post('/projects/:projectId/auto-generate-hotspots', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: req.user.id })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all rooms
    const rooms = await db('rooms')
      .where({ project_id: projectId })
      .orderBy('created_at', 'asc');

    if (rooms.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 rooms to generate hotspots' });
    }

    const hotspotsToCreate = [];

    // Simple heuristic: Connect each room to its neighbors in a sequence
    for (let i = 0; i < rooms.length - 1; i++) {
      const currentRoom = rooms[i];
      const nextRoom = rooms[i + 1];

      // Forward hotspot (current -> next)
      hotspotsToCreate.push({
        source_room_id: currentRoom.id,
        target_room_id: nextRoom.id,
        coordinates_x: Math.cos(currentRoom.rotation_y * Math.PI / 180) * 3,
        coordinates_y: 0,
        coordinates_z: Math.sin(currentRoom.rotation_y * Math.PI / 180) * 3,
        rotation_y: nextRoom.rotation_y,
        label: `Go to ${nextRoom.name}`,
        icon: 'arrow_forward',
        color: '#00ff00'
      });

      // Backward hotspot (next -> current)
      hotspotsToCreate.push({
        source_room_id: nextRoom.id,
        target_room_id: currentRoom.id,
        coordinates_x: Math.cos((nextRoom.rotation_y + 180) * Math.PI / 180) * 3,
        coordinates_y: 0,
        coordinates_z: Math.sin((nextRoom.rotation_y + 180) * Math.PI / 180) * 3,
        rotation_y: currentRoom.rotation_y,
        label: `Go to ${currentRoom.name}`,
        icon: 'arrow_back',
        color: '#00ff00'
      });
    }

    // Insert hotspots, ignoring duplicates
    let created = 0;
    for (const hotspot of hotspotsToCreate) {
      try {
        await db('navigation_hotspots').insert(hotspot);
        created++;
      } catch (error) {
        if (error.code !== '23505') { // Ignore unique constraint violations
          throw error;
        }
      }
    }

    logger.info(`Auto-generated ${created} hotspots for project ${projectId}`);
    res.json({ 
      message: 'Hotspots generated successfully', 
      created_count: created,
      skipped_count: hotspotsToCreate.length - created
    });

  } catch (error) {
    logger.error('Error auto-generating hotspots:', error);
    res.status(500).json({ error: 'Failed to generate hotspots' });
  }
});

module.exports = router;
