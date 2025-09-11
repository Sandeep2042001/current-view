exports.up = function(knex) {
  return knex.schema.createTable('measurements', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
    table.string('type').notNullable(); // point_to_point, corner, edge
    table.json('points').notNullable(); // Array of 3D points
    table.decimal('distance', 10, 3).nullable(); // Calculated distance
    table.string('unit').defaultTo('meters');
    table.string('label').nullable();
    table.json('metadata').nullable(); // Additional measurement data
    table.timestamps(true, true);
    
    table.index(['room_id']);
    table.index(['type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('measurements');
};
