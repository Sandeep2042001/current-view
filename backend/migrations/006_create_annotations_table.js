exports.up = function(knex) {
  return knex.schema.createTable('annotations', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
    table.string('type').notNullable(); // point, polygon, line
    table.json('coordinates').notNullable(); // Array of 3D coordinates
    table.string('title').nullable();
    table.text('description').nullable();
    table.json('style').nullable(); // Visual styling options
    table.timestamps(true, true);
    
    table.index(['room_id']);
    table.index(['type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('annotations');
};
