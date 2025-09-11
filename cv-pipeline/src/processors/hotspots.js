const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');

async function processHotspotGenerationJob(job) {
  const { room_id } = job.data;
  
  try {
    logger.info(`Starting hotspot generation for room ${room_id}`);

    // Get room and its project
    const room = await db('rooms')
      .join('projects', 'rooms.project_id', 'projects.id')
      .where({ 'rooms.id': room_id })
      .first();

    if (!room) {
      throw new Error('Room not found');
    }

    // Get all rooms in the project for navigation hotspots
    const projectRooms = await db('rooms')
      .where({ project_id: room.project_id, status: 'completed' })
      .orderBy('created_at', 'asc');

    // Generate navigation hotspots
    const navigationHotspots = await generateNavigationHotspots(room, projectRooms);

    // Generate info hotspots (auto-detected points of interest)
    const infoHotspots = await generateInfoHotspots(room);

    // Save hotspots to database
    const allHotspots = [...navigationHotspots, ...infoHotspots];
    
    if (allHotspots.length > 0) {
      await db('hotspots').insert(allHotspots);
    }

    logger.info(`Generated ${allHotspots.length} hotspots for room ${room_id}`);

    return {
      navigation_hotspots: navigationHotspots.length,
      info_hotspots: infoHotspots.length,
      total_hotspots: allHotspots.length
    };

  } catch (error) {
    logger.error(`Hotspot generation failed for room ${room_id}:`, error);
    throw error;
  }
}

async function generateNavigationHotspots(currentRoom, allRooms) {
  const hotspots = [];
  
  // Create navigation hotspots to other rooms
  for (const room of allRooms) {
    if (room.id === currentRoom.id) continue;

    // Calculate position on sphere for navigation hotspot
    const position = calculateNavigationPosition(currentRoom, room);
    
    hotspots.push({
      room_id: currentRoom.id,
      target_room_id: room.id,
      type: 'navigation',
      position: position,
      title: `Go to ${room.name}`,
      description: `Navigate to ${room.name}`,
      is_auto_generated: true,
      data: {
        transition_type: 'smooth',
        animation_duration: 1000
      }
    });
  }

  return hotspots;
}

async function generateInfoHotspots(room) {
  const hotspots = [];
  
  // This is a simplified implementation
  // In production, you would use computer vision to detect:
  // - Text/signs in the image
  // - Objects of interest
  // - Architectural features
  // - Points where users might want information

  // For now, we'll create some example info hotspots
  const infoPositions = [
    { x: 0.3, y: 0.2, z: 0.9 }, // Front center
    { x: -0.5, y: 0.1, z: 0.8 }, // Left side
    { x: 0.5, y: 0.1, z: 0.8 },  // Right side
    { x: 0, y: -0.3, z: 0.9 }    // Bottom center
  ];

  const infoTitles = [
    'Main Area',
    'Side View',
    'Another View',
    'Floor Level'
  ];

  const infoDescriptions = [
    'This is the main area of the room',
    'View from the left side',
    'View from the right side',
    'Floor level information'
  ];

  for (let i = 0; i < infoPositions.length; i++) {
    hotspots.push({
      room_id: room.id,
      target_room_id: null,
      type: 'info',
      position: infoPositions[i],
      title: infoTitles[i],
      description: infoDescriptions[i],
      is_auto_generated: true,
      data: {
        icon: 'info',
        show_on_hover: true
      }
    });
  }

  return hotspots;
}

function calculateNavigationPosition(currentRoom, targetRoom) {
  // Calculate a position on the sphere for the navigation hotspot
  // This is a simplified calculation - in production, you would use
  // more sophisticated algorithms based on room layout and user behavior
  
  const roomIndex = targetRoom.id.charCodeAt(0) % 8; // Simple hash for positioning
  const angle = (roomIndex / 8) * 2 * Math.PI;
  
  return {
    x: Math.cos(angle) * 0.8,
    y: 0.1,
    z: Math.sin(angle) * 0.8
  };
}

module.exports = {
  processHotspotGenerationJob
};
