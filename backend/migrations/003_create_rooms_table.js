exports.up = function(knex) {
  return knex.schema.createTable('rooms', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.json('position').nullable(); // 3D position in the tour
    table.json('rotation').nullable(); // 3D rotation
    table.string('status').defaultTo('pending'); // pending, processing, completed, failed
    table.timestamps(true, true);
    
    table.index(['project_id']);
    table.index(['status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rooms');
};
