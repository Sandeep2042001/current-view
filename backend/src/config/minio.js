const Minio = require('minio');
const logger = require('../utils/logger');

let minioClient;

async function connectMinIO() {
  try {
    minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    });

    // Check if bucket exists, create if not
    const bucketName = process.env.MINIO_BUCKET || 'interactive360';
    const bucketExists = await minioClient.bucketExists(bucketName);
    
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      logger.info(`Created bucket: ${bucketName}`);
    }

    logger.info('MinIO connected successfully');
    return minioClient;
  } catch (error) {
    logger.error('MinIO connection failed:', error);
    throw error;
  }
}

function getMinioClient() {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }
  return minioClient;
}

module.exports = {
  connectMinIO,
  getMinioClient
};
