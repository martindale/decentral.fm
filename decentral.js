var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = decentral.mongoose;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var Torrent = require('node-torrent-stream');
var crypto = require('crypto');

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
    donations: {
      type: { type: String , enum: ['bitcoin'] },
      destination: { type: String }
    },
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
    audio:    { type: 'File' },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String },
    hash: { type: String , max: 32 },
    credits:  [ Credit.Schema ]
  },
  icon: 'sound'
});

Recording.on('file', function(file) {
  var recording = this;
  console.log('hello, file');
  
  var shasum = crypto.createHash('md5');
  file.on('data', function(d) {
    console.log('data event', d );
    shasum.update(d);
  });
  
  file.on('end', function() {
    var d = shasum.digest('hex');
    console.log('done! md5: ' , d );
    recording.hash = d;
  });
  
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
