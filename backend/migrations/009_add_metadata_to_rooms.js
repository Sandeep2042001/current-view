exports.up = function(knex) {
  return Promise.resolve(); // Migration already applied in 003_create_rooms_table.js
};

exports.down = function(knex) {
  return Promise.resolve(); // No need to rollback
};
