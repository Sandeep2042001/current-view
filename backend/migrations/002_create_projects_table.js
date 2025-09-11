exports.up = function(knex) {
  return knex.schema.createTable('projects', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.string('status').defaultTo('draft'); // draft, processing, completed, failed
    table.json('settings').nullable(); // Project-specific settings
    table.json('metadata').nullable(); // Additional metadata
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('projects');
};
