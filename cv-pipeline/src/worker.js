const redis = require('redis');
const { db } = require('./config/database');
const { getMinioClient } = require('./config/minio');
const logger = require('./utils/logger');
const { processStitchingJob } = require('./processors/stitching');
const { process3DReconstructionJob } = require('./processors/reconstruction');
const { processHotspotGenerationJob } = require('./processors/hotspots');

class CVWorker {
  constructor() {
    this.redisClient = null;
    this.isProcessing = false;
  }

  async connect() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
      logger.info('CV Worker connected to Redis');

      // Start processing loop
      this.startProcessing();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async startProcessing() {
    logger.info('CV Worker started, waiting for jobs...');
    
    while (true) {
      try {
        if (this.isProcessing) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Get job from queue (blocking pop with timeout)
        const jobData = await this.redisClient.brPop('cv-processing-queue', 5);
        
        if (jobData) {
          const job = JSON.parse(jobData.element);
          await this.processJob(job);
        }
      } catch (error) {
        logger.error('Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processJob(job) {
    this.isProcessing = true;
    
    try {
      logger.info(`Processing job: ${job.jobId} (${job.type})`);

      // Update job status to processing
      await db('processing_jobs')
        .where({ id: job.jobId })
        .update({
          status: 'processing',
          started_at: new Date()
        });

      let result;

      // Process based on job type
      switch (job.type) {
        case 'stitching':
          result = await processStitchingJob(job);
          break;
        case '3d_reconstruction':
          result = await process3DReconstructionJob(job);
          break;
        case 'hotspot_generation':
          result = await processHotspotGenerationJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Update job as completed
      await db('processing_jobs')
        .where({ id: job.jobId })
        .update({
          status: 'completed',
          output_data: result,
          completed_at: new Date()
        });

      logger.info(`Job completed: ${job.jobId}`);

    } catch (error) {
      logger.error(`Job failed: ${job.jobId}`, error);

      // Update job as failed
      await db('processing_jobs')
        .where({ id: job.jobId })
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date()
        });
    } finally {
      this.isProcessing = false;
    }
  }
}

// Start worker
async function startWorker() {
  try {
    const worker = new CVWorker();
    await worker.connect();
  } catch (error) {
    logger.error('Failed to start CV worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down CV worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down CV worker');
  process.exit(0);
});

startWorker();

module.exports = CVWorker;
