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
  return true;
};

module.exports = Context;
