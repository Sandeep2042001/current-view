const { getMinioClient } = require('../config/minio');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const sharp = require('sharp');

/**
 * Building-Level Stitching Processor
 * Combines all room 360° views into a seamless building-wide panorama
 * Creates hierarchical hotspots for navigation between rooms
 */
async function processBuildingStitchingJob(job) {
  const { project_id } = job.data;
  
  try {
    logger.info(`Starting building-level stitching for project ${project_id}`);
    
    // Get all completed rooms in the project
    const rooms = await db('rooms')
      .where({ 
        project_id: project_id,
        status: 'completed' 
      })
      .orderBy('created_at', 'asc');

    if (rooms.length < 1) {
      throw new Error('No completed rooms found for building stitching');
    }

    logger.info(`Found ${rooms.length} completed rooms for building stitching`);

    // Download room panoramas from MinIO
    const minioClient = getMinioClient();
    const roomPanoramas = [];
    
    for (const room of rooms) {
      try {
        // Get stitched panorama path from room metadata
        const stitchedPath = room.metadata?.stitched_image_path;
        
        if (!stitchedPath) {
          logger.warning(`Room ${room.name} has no stitched panorama, skipping`);
          continue;
        }

        logger.info(`Downloading panorama for room: ${room.name}`);
        
        const stream = await minioClient.getObject(
          process.env.MINIO_BUCKET || 'interactive360',
          stitchedPath
        );
        
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        
        roomPanoramas.push({
          room_id: room.id,
          room_name: room.name,
          position: room.position,
          rotation: room.rotation,
          buffer: buffer,
          metadata: room.metadata
        });
        
        logger.info(`Downloaded panorama for room ${room.name}: ${buffer.length} bytes`);
        
      } catch (minioError) {
        logger.error(`Failed to download panorama for room ${room.name}:`, minioError);
        // Continue with other rooms
      }
    }

    if (roomPanoramas.length < 1) {
      throw new Error('No valid room panoramas found for building stitching');
    }

    // Create building-wide panorama
    logger.info(`Creating building-wide panorama with ${roomPanoramas.length} rooms`);
    const buildingPanorama = await createBuildingPanorama(roomPanoramas, project_id);

    // Generate building-level hotspots
    const buildingHotspots = await generateBuildingHotspots(rooms, roomPanoramas);

    // Upload building panorama to MinIO
    const buildingPanoramaPath = `projects/${project_id}/building/panorama_${Date.now()}.jpg`;
    await minioClient.putObject(
      process.env.MINIO_BUCKET || 'interactive360',
      buildingPanoramaPath,
      buildingPanorama.buffer,
      {
        'Content-Type': 'image/jpeg',
        'Content-Length': buildingPanorama.buffer.length,
        'X-Building-Panorama': 'true',
        'X-Rooms-Count': roomPanoramas.length.toString()
      }
    );

    // Save building hotspots to database
    if (buildingHotspots.length > 0) {
      await db('hotspots').insert(buildingHotspots);
    }

    // Update project metadata with building panorama info
    await db('projects')
      .where({ id: project_id })
      .update({
        status: 'completed',
        metadata: {
          building_panorama_path: buildingPanoramaPath,
          building_panorama_size: buildingPanorama.buffer.length,
          rooms_count: roomPanoramas.length,
          hotspots_count: buildingHotspots.length,
          stitching_quality: buildingPanorama.quality
        }
      });

    logger.info(`Building-level stitching completed for project ${project_id}`);
    console.log(`✅ BUILDING STITCHING SUCCESS: Project ${project_id} - ${roomPanoramas.length} rooms, ${buildingHotspots.length} hotspots`);

    return {
      success: true,
      building_panorama_path: buildingPanoramaPath,
      rooms_processed: roomPanoramas.length,
      hotspots_generated: buildingHotspots.length,
      quality: buildingPanorama.quality
    };

  } catch (error) {
    logger.error(`Building stitching failed for project ${project_id}:`, error);
    console.error(`❌ BUILDING STITCHING FAILED: Project ${project_id} - ${error.message}`);
    
    // Update project status to failed
    await db('projects')
      .where({ id: project_id })
      .update({ status: 'failed' });

    throw error;
  }
}

/**
 * Create building-wide panorama by combining room panoramas
 */
async function createBuildingPanorama(roomPanoramas, projectId) {
  try {
    logger.info(`Creating building panorama with ${roomPanoramas.length} room panoramas`);

    // For now, we'll create a composite panorama
    // In a real implementation, you would use advanced stitching to create a seamless panorama
    
    if (roomPanoramas.length === 1) {
      // Single room - just return the panorama
      logger.info('Single room building - using room panorama as-is');
      return {
        buffer: roomPanoramas[0].buffer,
        quality: 95,
        metadata: {
          type: 'single_room',
          room_id: roomPanoramas[0].room_id
        }
      };
    }

    // Multiple rooms - create a composite panorama
    logger.info('Multiple rooms - creating composite building panorama');
    
    // Calculate dimensions for composite
    const firstPanorama = roomPanoramas[0];
    const firstImageInfo = await sharp(firstPanorama.buffer).metadata();
    
    // Create a wider canvas for the building panorama
    const buildingWidth = firstImageInfo.width * roomPanoramas.length;
    const buildingHeight = firstImageInfo.height;
    
    const compositeImages = roomPanoramas.map((roomPanorama, index) => {
      logger.info(`Adding room panorama ${index + 1}: ${roomPanorama.room_name}`);
      return {
        input: roomPanorama.buffer,
        left: index * firstImageInfo.width,
        top: 0
      };
    });

    const buildingBuffer = await sharp({
      create: {
        width: buildingWidth,
        height: buildingHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite(compositeImages)
    .jpeg({ quality: 95 })
    .toBuffer();

    logger.info(`Building panorama created: ${buildingWidth}x${buildingHeight} pixels`);

    return {
      buffer: buildingBuffer,
      quality: 90,
      metadata: {
        type: 'multi_room_composite',
        rooms_count: roomPanoramas.length,
        dimensions: { width: buildingWidth, height: buildingHeight }
      }
    };

  } catch (error) {
    logger.error('Failed to create building panorama:', error);
    throw new Error('Failed to create building panorama');
  }
}

/**
 * Generate building-level hotspots for navigation between rooms
 */
async function generateBuildingHotspots(rooms, roomPanoramas) {
  const hotspots = [];
  
  logger.info(`Generating building hotspots for ${rooms.length} rooms`);

  // Create navigation hotspots between rooms
  for (let i = 0; i < roomPanoramas.length; i++) {
    const currentRoom = roomPanoramas[i];
    
    // Create hotspots to other rooms
    for (let j = 0; j < roomPanoramas.length; j++) {
      if (i === j) continue;
      
      const targetRoom = roomPanoramas[j];
      
      // Calculate position for navigation hotspot
      const position = calculateBuildingHotspotPosition(i, j, roomPanoramas.length);
      
      hotspots.push({
        room_id: currentRoom.room_id,
        target_room_id: targetRoom.room_id,
        type: 'navigation',
        position: position,
        title: `Go to ${targetRoom.room_name}`,
        description: `Navigate to ${targetRoom.room_name}`,
        is_auto_generated: true,
        data: {
          transition_type: 'smooth',
          animation_duration: 1500,
          building_level: true,
          source_room: currentRoom.room_name,
          target_room: targetRoom.room_name
        }
      });
    }
  }

  // Create building-level info hotspots
  const infoPositions = [
    { x: 0.5, y: 0.2, z: 0.8 },   // Center top
    { x: -0.3, y: 0.1, z: 0.9 },  // Left side
    { x: 0.3, y: 0.1, z: 0.9 },   // Right side
    { x: 0, y: -0.2, z: 0.9 }     // Bottom center
  ];

  const infoTitles = [
    'Building Overview',
    'Room Navigation',
    'Interactive Features',
    'Floor Plan'
  ];

  const infoDescriptions = [
    'View the entire building layout',
    'Navigate between different rooms',
    'Access interactive features and tools',
    'View building floor plan'
  ];

  for (let i = 0; i < infoPositions.length; i++) {
    hotspots.push({
      room_id: null, // Building-level hotspot
      target_room_id: null,
      type: 'info',
      position: infoPositions[i],
      title: infoTitles[i],
      description: infoDescriptions[i],
      is_auto_generated: true,
      data: {
        icon: 'info',
        show_on_hover: true,
        building_level: true,
        feature_type: infoTitles[i].toLowerCase().replace(' ', '_')
      }
    });
  }

  logger.info(`Generated ${hotspots.length} building-level hotspots`);
  return hotspots;
}

/**
 * Calculate position for building-level navigation hotspots
 */
function calculateBuildingHotspotPosition(sourceIndex, targetIndex, totalRooms) {
  // Calculate angle based on room positions
  const sourceAngle = (sourceIndex / totalRooms) * 2 * Math.PI;
  const targetAngle = (targetIndex / totalRooms) * 2 * Math.PI;
  
  // Position hotspot between source and target
  const angle = (sourceAngle + targetAngle) / 2;
  
  return {
    x: Math.cos(angle) * 0.7,
    y: 0.1,
    z: Math.sin(angle) * 0.7
  };
}

module.exports = {
  processBuildingStitchingJob
};
