#!/bin/bash

# Export data from local PostgreSQL to Railway
echo "📤 Exporting local database to Railway..."

# Export schema and data
docker-compose exec postgres pg_dump -U postgres -d interactive360 --clean --create > local_database_backup.sql

echo "✅ Database exported to local_database_backup.sql"
echo "📋 Next steps:"
echo "1. Update railway.env with your Railway database credentials"
echo "2. Run: node migrate-to-railway.js"
echo "3. Import data: psql -h [RAILWAY_HOST] -U postgres -d railway < local_database_backup.sql"
