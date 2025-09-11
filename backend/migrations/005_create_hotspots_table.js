exports.up = function(knex) {
  return knex.schema.createTable('hotspots', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
    table.uuid('target_room_id').references('id').inTable('rooms').nullable();
    table.string('type').notNullable(); // navigation, info, measurement
    table.json('position').notNullable(); // 3D position on sphere
    table.json('rotation').nullable(); // 3D rotation
    table.string('title').nullable();
    table.text('description').nullable();
    table.json('data').nullable(); // Additional hotspot data
    table.boolean('is_auto_generated').defaultTo(false);
    table.timestamps(true, true);
    
    table.index(['room_id']);
    table.index(['target_room_id']);
    table.index(['type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('hotspots');
};
