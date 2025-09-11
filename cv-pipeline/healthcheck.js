const redis = require('redis');

async function healthCheck() {
  try {
    const client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    await client.connect();
    await client.ping();
    await client.disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
