exports.up = function(knex) {
  return knex.schema.createTable('navigation_hotspots', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Source and target rooms for navigation
    table.uuid('source_room_id').references('id').inTable('rooms').onDelete('CASCADE').notNullable();
    table.uuid('target_room_id').references('id').inTable('rooms').onDelete('CASCADE').notNullable();
    
    // 3D position of the hotspot in the source room's coordinate space
    table.float('coordinates_x').notNullable();
    table.float('coordinates_y').notNullable();
    table.float('coordinates_z').notNullable();
    
    // Direction the hotspot "faces" or camera rotation after transition (in degrees)
    table.float('rotation_y').defaultTo(0.0);
    
    // Optional label for the hotspot
    table.string('label').nullable();
    
    // Visual properties
    table.string('icon').defaultTo('arrow_forward');
    table.string('color').defaultTo('#00ff00');
    
    // Metadata for future enhancements
    table.json('metadata').nullable();
    
    table.timestamps(true, true);
    
    // Indexes for efficient queries
    table.index(['source_room_id']);
    table.index(['target_room_id']);
    
    // Prevent duplicate hotspots between the same two rooms
    table.unique(['source_room_id', 'target_room_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('navigation_hotspots');
};
