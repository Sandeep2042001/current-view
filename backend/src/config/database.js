const knex = require('knex');
const logger = require('../utils/logger');

const config = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'interactive360',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

const db = knex(config);

async function connectDatabase() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connected successfully');
    
    // Run migrations
    await db.migrate.latest();
    logger.info('Database migrations completed');
    
    return db;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

module.exports = {
  db,
  connectDatabase
};
