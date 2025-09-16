const express = require('express');
const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const annotationSchema = Joi.object({
  type: Joi.string().valid('point', 'polygon', 'line').required(),
  coordinates: Joi.array().items(
    Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      z: Joi.number().required()
    })
  ).min(1).required(),
  title: Joi.string().max(255).allow('').optional(),
  description: Joi.string().max(1000).allow('').optional(),
  style: Joi.object({
    color: Joi.string().optional(),
    size: Joi.number().min(1).max(20).optional(),
    opacity: Joi.number().min(0.1).max(1).optional(),
    showLabels: Joi.boolean().optional()
  }).optional()
});

const updateAnnotationSchema = Joi.object({
  title: Joi.string().max(255).allow('').optional(),
  description: Joi.string().max(1000).allow('').optional(),
  style: Joi.object({
    color: Joi.string().optional(),
    size: Joi.number().min(1).max(20).optional(),
    opacity: Joi.number().min(0.1).max(1).optional(),
    showLabels: Joi.boolean().optional()
  }).optional()
});

// Utility function to calculate polygon area (2D projection on XZ plane)
const calculatePolygonArea = (coordinates) => {
  if (coordinates.length < 3) return 0;

  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i].x * coordinates[j].z;
    area -= coordinates[j].x * coordinates[i].z;
  }
  
  return Math.abs(area) / 2;
};

// Utility function to calculate line length
const calculateLineLength = (coordinates) => {
  if (coordinates.length < 2) return 0;

  let length = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const dx = coordinates[i + 1].x - coordinates[i].x;
    const dy = coordinates[i + 1].y - coordinates[i].y;
    const dz = coordinates[i + 1].z - coordinates[i].z;
    length += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  return length;
};

// Utility function to check if point is inside polygon (2D projection)
const isPointInPolygon = (point, polygon) => {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (((polygon[i].z > point.z) !== (polygon[j].z > point.z)) &&
        (point.x < (polygon[j].x - polygon[i].x) * (point.z - polygon[i].z) / (polygon[j].z - polygon[i].z) + polygon[i].x)) {
      inside = !inside;
    }
  }
  
  return inside;
};

// Get all annotations for a room
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { type } = req.query;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    let query = db('annotations')
      .where({ room_id: roomId })
      .orderBy('created_at', 'desc');

    if (type && ['point', 'polygon', 'line'].includes(type)) {
      query = query.where({ type });
    }

    const annotations = await query;

    res.json(annotations);
  } catch (error) {
    logger.error('Error fetching annotations:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// Get single annotation
router.get('/:roomId/:annotationId', async (req, res) => {
  try {
    const { roomId, annotationId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotation = await db('annotations')
      .where({ id: annotationId, room_id: roomId })
      .first();

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json(annotation);
  } catch (error) {
    logger.error('Error fetching annotation:', error);
    res.status(500).json({ error: 'Failed to fetch annotation' });
  }
});

// Create new annotation
router.post('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { error, value } = annotationSchema.validate(req.body);

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

    // Validate coordinates based on annotation type
    if (value.type === 'point' && value.coordinates.length !== 1) {
      return res.status(400).json({ error: 'Point annotations must have exactly 1 coordinate' });
    }

    if (value.type === 'polygon' && value.coordinates.length < 3) {
      return res.status(400).json({ error: 'Polygon annotations must have at least 3 coordinates' });
    }

    if (value.type === 'line' && value.coordinates.length < 2) {
      return res.status(400).json({ error: 'Line annotations must have at least 2 coordinates' });
    }

    // Set default style if not provided
    const defaultStyle = {
      color: '#2196F3',
      size: 3,
      opacity: 0.8,
      showLabels: true
    };

    const finalStyle = { ...defaultStyle, ...value.style };

    const [annotation] = await db('annotations')
      .insert({
        room_id: roomId,
        type: value.type,
        coordinates: JSON.stringify(value.coordinates),
        title: value.title || '',
        description: value.description || '',
        style: finalStyle
      })
      .returning('*');

    logger.info(`Annotation created: ${annotation.id} in room ${roomId} by user ${req.user.id}`);

    res.status(201).json(annotation);
  } catch (error) {
    logger.error('Error creating annotation:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

// Update annotation
router.put('/:roomId/:annotationId', async (req, res) => {
  try {
    const { roomId, annotationId } = req.params;
    const { error, value } = updateAnnotationSchema.validate(req.body);

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

    const annotation = await db('annotations')
      .where({ id: annotationId, room_id: roomId })
      .first();

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    // Merge existing style with new style if provided
    let updatedStyle = annotation.style;
    if (value.style) {
      updatedStyle = { ...annotation.style, ...value.style };
    }

    const [updatedAnnotation] = await db('annotations')
      .where({ id: annotationId })
      .update({
        title: value.title !== undefined ? value.title : annotation.title,
        description: value.description !== undefined ? value.description : annotation.description,
        style: updatedStyle,
        updated_at: new Date()
      })
      .returning('*');

    logger.info(`Annotation updated: ${annotationId} by user ${req.user.id}`);

    res.json(updatedAnnotation);
  } catch (error) {
    logger.error('Error updating annotation:', error);
    res.status(500).json({ error: 'Failed to update annotation' });
  }
});

// Delete annotation
router.delete('/:roomId/:annotationId', async (req, res) => {
  try {
    const { roomId, annotationId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotation = await db('annotations')
      .where({ id: annotationId, room_id: roomId })
      .first();

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    await db('annotations')
      .where({ id: annotationId })
      .del();

    logger.info(`Annotation deleted: ${annotationId} by user ${req.user.id}`);

    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    logger.error('Error deleting annotation:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

// Get annotations statistics for a room
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

    const stats = await db('annotations')
      .where({ room_id: roomId })
      .select([
        db.raw('COUNT(*) as total_annotations'),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as point_count', ['point']),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as polygon_count', ['polygon']),
        db.raw('COUNT(CASE WHEN type = ? THEN 1 END) as line_count', ['line']),
        db.raw('COUNT(CASE WHEN title IS NOT NULL AND title != ? THEN 1 END) as titled_count', [''])
      ])
      .first();

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching annotation statistics:', error);
    res.status(500).json({ error: 'Failed to fetch annotation statistics' });
  }
});

// Calculate geometric properties for annotation
router.get('/:roomId/:annotationId/properties', async (req, res) => {
  try {
    const { roomId, annotationId } = req.params;

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotation = await db('annotations')
      .where({ id: annotationId, room_id: roomId })
      .first();

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const coordinates = JSON.parse(annotation.coordinates);
    const properties = {
      type: annotation.type,
      coordinateCount: coordinates.length
    };

    if (annotation.type === 'polygon') {
      properties.area = calculatePolygonArea(coordinates);
      properties.perimeter = calculateLineLength([...coordinates, coordinates[0]]); // Close the polygon
    } else if (annotation.type === 'line') {
      properties.length = calculateLineLength(coordinates);
    }

    res.json(properties);
  } catch (error) {
    logger.error('Error calculating annotation properties:', error);
    res.status(500).json({ error: 'Failed to calculate annotation properties' });
  }
});

// Check if a point intersects with annotations
router.post('/:roomId/intersect', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { point } = req.body;

    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || typeof point.z !== 'number') {
      return res.status(400).json({ error: 'Valid point coordinates (x, y, z) are required' });
    }

    // Verify room exists and belongs to user
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': roomId, 'projects.user_id': req.user.id })
      .first();

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotations = await db('annotations')
      .where({ room_id: roomId, type: 'polygon' });

    const intersections = [];

    for (const annotation of annotations) {
      const coordinates = JSON.parse(annotation.coordinates);
      if (isPointInPolygon(point, coordinates)) {
        intersections.push({
          id: annotation.id,
          title: annotation.title,
          type: annotation.type
        });
      }
    }

    res.json({
      point,
      intersections,
      intersectionCount: intersections.length
    });
  } catch (error) {
    logger.error('Error checking annotation intersections:', error);
    res.status(500).json({ error: 'Failed to check annotation intersections' });
  }
});

module.exports = router;
