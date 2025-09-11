exports.up = function(knex) {
  return knex.schema.createTable('processing_jobs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.string('type').notNullable(); // stitching, 3d_reconstruction, hotspot_generation
    table.string('status').defaultTo('pending'); // pending, processing, completed, failed
    table.json('input_data').notNullable(); // Input parameters
    table.json('output_data').nullable(); // Output results
    table.text('error_message').nullable();
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
    
    table.index(['project_id']);
    table.index(['status']);
    table.index(['type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('processing_jobs');
};
