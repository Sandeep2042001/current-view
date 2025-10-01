const knex = require('knex');

// Railway Database Configuration
const railwayConfig = {
  client: 'postgresql',
  connection: {
    host: process.env.RAILWAY_DB_HOST,
    port: process.env.RAILWAY_DB_PORT,
    database: process.env.RAILWAY_DB_NAME,
    user: process.env.RAILWAY_DB_USER,
    password: process.env.RAILWAY_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  migrations: {
    directory: './migrations'
  }
};

async function migrateToRailway() {
  console.log('🚂 Connecting to Railway database...');
  
  const db = knex(railwayConfig);
  
  try {
    console.log('📋 Running migrations...');
    await db.migrate.latest();
    console.log('✅ Migrations completed successfully!');
    
    // Test connection
    const result = await db.raw('SELECT NOW()');
    console.log('🕐 Railway database time:', result.rows[0].now);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.destroy();
  }
}

// Load environment variables
require('dotenv').config({ path: './railway.env' });

migrateToRailway();
