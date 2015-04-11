function Context( options ) {
  var self = this;
  
  self.extends = {
    resources: {
      'Person': {
        plugin: function(schema, options) {
          schema.methods.can = self.can;
        }
      }
    }
  };
}

Context.prototype.can = function( action , object ) {
  var id = this._id.toString();
  var map = object._show.credits.map(function(x) {
    return x._person.toString();
  });
  return (~map.indexOf( id ));
};

module.exports = Context;
