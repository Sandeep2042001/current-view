exports.up = function(knex) {
  return knex.schema.alterTable('rooms', function(table) {
    table.json('metadata').nullable(); // Store stitching results and other metadata
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('rooms', function(table) {
    table.dropColumn('metadata');
  });
};
