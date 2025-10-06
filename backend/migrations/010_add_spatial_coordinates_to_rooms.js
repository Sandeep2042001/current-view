exports.up = function(knex) {
  return knex.schema.alterTable('rooms', function(table) {
    // 3D Spatial coordinates for room positioning in virtual tour
    table.float('initial_coordinates_x').defaultTo(0.0);
    table.float('initial_coordinates_y').defaultTo(0.0);
    table.float('initial_coordinates_z').defaultTo(0.0);
    
    // Initial camera rotation (Yaw) in degrees
    table.float('rotation_y').defaultTo(0.0);
    
    // Flag to indicate the starting point of the tour
    table.boolean('is_starting_room').defaultTo(false);
    
    // Add index for quick lookup of starting room
    table.index(['is_starting_room']);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('rooms', function(table) {
    table.dropColumn('initial_coordinates_x');
    table.dropColumn('initial_coordinates_y');
    table.dropColumn('initial_coordinates_z');
    table.dropColumn('rotation_y');
    table.dropColumn('is_starting_room');
    table.dropIndex(['is_starting_room']);
  });
};
