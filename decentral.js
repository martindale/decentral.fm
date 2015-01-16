var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = decentral.mongoose;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var nt = require('nt');
var SoundCloud = require('soundjs');

// placeholder for a more robust config management solution
decentral._config = require('./config/decentral');

var sc = decentral._config.services.soundcloud;
var soundcloud = new SoundCloud( sc.id , sc.secret );

var Credit = decentral.define('Credit', {
  internal: true,
  attributes: {
    _person: { type: ObjectId , ref: 'Person', required: true },
    role: { type: String , enum: ['host', 'producer', 'guest'] }
  }
});

var Show = decentral.define('Show', {
  attributes: {
    name:    { type: String , max: 35 , required: true , slug: true },
    created: { type: Date , default: Date.now , required: true },
    description: { type: String },
    hosts:     [ Credit.Schema ],
    producers: [ Credit.Schema ],
    remotes: {
      soundcloud: {
        
      }
    }
  },
  icon: 'unmute'
});

var Recording = decentral.define('Recording', {
  attributes: {
    _show:    { type: ObjectId , ref: 'Show', required: true , alias: 'show' },
    title:    { type: String , max: 35 , required: true , slug: true },
    audio:    { type: 'File' , required: true },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
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

Recording.on('create', function() {
  var recording = this;
  
  
  
});

decentral.start();
