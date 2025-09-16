const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const measurementSchema = Joi.object({
  type: Joi.string().valid('point_to_point', 'corner', 'edge').required(),
  points: Joi.array().items(
    Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      z: Joi.number().required()
    })
  ).min(1).required(),
  distance: Joi.number().optional(),
  unit: Joi.string().valid('meters', 'feet', 'inches', 'centimeters', 'millimeters').default('meters'),
  label: Joi.string().max(255).allow('').optional(),
  metadata: Joi.object().optional()
});

const updateMeasurementSchema = Joi.object({
  label: Joi.string().max(255).allow('').optional(),
  metadata: Joi.object().optional()
});

// Utility function to calculate distance between two 3D points
const calculateDistance = (point1, point2) => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// Utility function to calculate angle at middle point
const calculateAngle = (point1, point2, point3) => {
  const v1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y,
    z: point1.z - point2.z
  };
  
  const v2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y,
    z: point3.z - point2.z
  };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  
  const cosAngle = dot / (mag1 * mag2);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  
  return (angle * 180) / Math.PI; // Convert to degrees
};

// Get all measurements for a room
router.get('/:roomId', async (req, res) => {
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

    const measurements = await db('measurements')
      .where({ room_id: roomId })
      .orderBy('created_at', 'desc');

    res.json(measurements);
  } catch (error) {
    logger.error('Error fetching measurements:', error);
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
});

// Get single measurement
router.get('/:roomId/:measurementId', async (req, res) => {
  try {
    const { roomId, measurementId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const measurement = await db('measurements')
      .where({ id: measurementId, room_id: roomId })
      .first();

    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    res.json(measurement);
  } catch (error) {
    logger.error('Error fetching measurement:', error);
    res.status(500).json({ error: 'Failed to fetch measurement' });
  }
});

// Create new measurement
router.post('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { error, value } = measurementSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Calculate distance based on measurement type
    let calculatedDistance = null;
    let calculatedMetadata = value.metadata || {};

    if (value.type === 'point_to_point' && value.points.length >= 2) {
      calculatedDistance = calculateDistance(value.points[0], value.points[value.points.length - 1]);
    } else if (value.type === 'edge' && value.points.length >= 2) {
      // Calculate total length for edge measurements
      let totalDistance = 0;
      for (let i = 0; i < value.points.length - 1; i++) {
        totalDistance += calculateDistance(value.points[i], value.points[i + 1]);
      }
      calculatedDistance = totalDistance;
    } else if (value.type === 'corner' && value.points.length >= 3) {
      // For corner measurements, calculate both distance and angle
      calculatedDistance = calculateDistance(value.points[0], value.points[value.points.length - 1]);
      calculatedMetadata.angle = calculateAngle(value.points[0], value.points[1], value.points[2]);
    }

    const [measurement] = await db('measurements')
      .insert({
        room_id: roomId,
        type: value.type,
        points: JSON.stringify(value.points),
        distance: calculatedDistance,
        unit: value.unit,
        label: value.label || '',
        metadata: calculatedMetadata
      })
      .returning('*');

    logger.info(`Measurement created: ${measurement.id} in room ${roomId} by user ${req.user.id}`);

    res.status(201).json(measurement);
  } catch (error) {
    logger.error('Error creating measurement:', error);
    res.status(500).json({ error: 'Failed to create measurement' });
  }
});

// Update measurement
router.put('/:roomId/:measurementId', async (req, res) => {
  try {
    const { roomId, measurementId } = req.params;
    const { error, value } = updateMeasurementSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const measurement = await db('measurements')
      .where({ id: measurementId, room_id: roomId })
      .first();

    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    const [updatedMeasurement] = await db('measurements')
      .where({ id: measurementId })
      .update({
        label: value.label !== undefined ? value.label : measurement.label,
        metadata: value.metadata !== undefined ? value.metadata : measurement.metadata,
        updated_at: new Date()
      })
      .returning('*');

    logger.info(`Measurement updated: ${measurementId} by user ${req.user.id}`);

    res.json(updatedMeasurement);
  } catch (error) {
    logger.error('Error updating measurement:', error);
    res.status(500).json({ error: 'Failed to update measurement' });
  }
});

// Delete measurement
router.delete('/:roomId/:measurementId', async (req, res) => {
  try {
    const { roomId, measurementId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const measurement = await db('measurements')
      .where({ id: measurementId, room_id: roomId })
      .first();

    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    await db('measurements')
      .where({ id: measurementId })
      .del();

    logger.info(`Measurement deleted: ${measurementId} by user ${req.user.id}`);

    res.json({ message: 'Measurement deleted successfully' });
  } catch (error) {
    logger.error('Error deleting measurement:', error);
    res.status(500).json({ error: 'Failed to delete measurement' });
  }
});

// Get measurements statistics for a room
router.get('/:roomId/stats', async (req, res) => {
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

    const stats = await db('measurements')
      .where({ room_id: roomId })
      .select([
        db.raw('COUNT(*) as total_measurements'),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as point_to_point_count', ['point_to_point']),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as corner_count', ['corner']),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as edge_count', ['edge']),
        db.raw('AVG(distance) as average_distance'),
        db.raw('MIN(distance) as min_distance'),
        db.raw('MAX(distance) as max_distance')
      ])
      .first();

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching measurement statistics:', error);
    res.status(500).json({ error: 'Failed to fetch measurement statistics' });
  }
});

module.exports = router;
