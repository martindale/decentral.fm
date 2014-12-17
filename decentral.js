var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var Credit = decentral.define('Credit', {
  internal: true,
  attributes: {
    _person: { type: ObjectId , ref: 'Person', required: true },
    role: { type: String , enum: ['host', 'producer', 'guest'] }
  }
});

var Show = decentral.define('Show', {
  attributes: {
    name:    { type: String , max: 35 , required: true , name: true },
    created: { type: Date , default: Date.now },
    description: { type: String },
    hosts:  [ Credit.Schema ]
  },
  icon: 'unmute'
});

var Recording = decentral.define('Recording', {
  attributes: {
    _show:    { type: ObjectId , ref: 'Show', required: true },
    title:    { type: String , max: 35 , required: true , name: true },
    recorded: { type: Date },
    released: { type: Date , default: Date.now },
    description: { type: String },
    credits:  [ Credit.Schema ]
  },
  icon: 'sound'
});

var Person = decentral.define('Person', {
  attributes: {
    name: {
      given: { type: String },
      family: { type: String }
    },
    gpg: {
      fingerprint: { type: String }
    },
    profiles: {}
  },
  virtuals: {
    'name.full': function() {
      return [ this.name.given , this.name.family ].join(' ');
    }
  },
  icon: 'user'
});

decentral.start();
