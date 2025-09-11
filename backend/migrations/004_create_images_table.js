exports.up = function(knex) {
  return knex.schema.createTable('images', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
    table.string('filename').notNullable();
    table.string('original_filename').notNullable();
    table.string('mime_type').notNullable();
    table.bigInteger('file_size').notNullable();
    table.string('storage_path').notNullable(); // MinIO object path
    table.json('metadata').nullable(); // EXIF, gyro, compass data
    table.json('processing_status').nullable(); // Processing status for each step
    table.timestamps(true, true);
    
    table.index(['room_id']);
    table.index(['storage_path']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('images');
};
