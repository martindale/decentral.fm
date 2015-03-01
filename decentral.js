var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = decentral.mongoose;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var Torrent = require('node-torrent-stream');
var readTorrent = require('read-torrent');
var magnet = require('magnet-uri');
var fileType = require('file-type');
var async = require('async');

var crypto = require('crypto');
var stream = require('stream');

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
      destination: { type: String , max: 35 }
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
    _show:    { type: ObjectId , ref: 'Show', required: false , alias: 'show' },
    title:    { type: String , max: 35 , required: true , slug: true },
    media:    { type: 'File', required: true },
    torrent:  { type: ObjectId , render: { create: false } },
    magnet:   { type: String , max: 24 , render: { create: false } },
    type:     { type: String , max: 5 , render: { create: false } },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String },
    hash: { type: String , max: 32 , render: { create: false } },
    credits:  [ Credit.Schema ]
  },
  icon: 'sound'
});

var Checksum = decentral.define('Checksum', {
  attributes: {
    filename: { type: String },
    _file: { type: ObjectId },
    _recording: { type: ObjectId },
    hash: { type: String , max: 35 },
    type: { type: String , enum: ['md5'] },
    created: { type: Date , default: Date.now }
  },
  icon: 'lock'
});

Recording.on('file:media', function(media) {
  console.log('received media:', media);
  
  var pass = new stream.PassThrough();
  var file = decentral.datastore.gfs.createReadStream({
    _id: media._id
  });
  
  async.parallel([
    determineType,
    createTorrent
  ], function(err, results) {
    var typeOfFile = results[0];
    var torrentFile = results[1];
    
    torrentFile.type = typeOfFile.mime;
    
    Recording.patch({
      _id: media.metadata.document
    }, [
      { op: 'add', path: '/torrent' , value: torrentFile._id },
      { op: 'add', path: '/magnet' , value: torrentFile.magnet },
      { op: 'add', path: '/type' , value: torrentFile.type }
    ], function(err, num) {
      if (err) console.error( err );
      console.log('all done,', num , 'affected');
    });
  });
  
  function determineType( innerComplete ) {
    var through = new stream.PassThrough();
    through.once('data', function(chunk) {
      //console.log(through);
      var type = fileType( chunk );
      console.log('TYPE EVALUATED: ' , type );
      innerComplete( null , type );
    });
    pass.pipe( through );
  }

  function createTorrent( innerComplete ) {
    var torrent = new Torrent({
      name: media.filename,
      trackers: config.torrents.trackers
    });
    
    var torrentstore = decentral.datastore.gfs.createWriteStream({
      mode: 'w',
      filename: media.filename + '.torrent',
      content_type: 'application/x-bittorrent'
    });
    torrentstore.on('error', function(data) {
      console.log('error!' , data );
    });
    torrentstore.on('close', function( torrentFile ) {
      readTorrent('http://localhost:15005/files/' + torrentFile._id , function(err, parsed) {
        if (err) console.error( err );
        torrentFile.magnet = magnet.encode( parsed );
        console.log('torrent file magnet:', torrentFile.magnet );
        return innerComplete( err , torrentFile );
      });

    });
      
    pass.pipe( torrentstore );
  }

  file.pipe( pass );

});

Recording.pre('create', function(next, done) {
  var recording = this;
  if (!recording.media) return next();

  var db = decentral.datastore.mongoose.connections[0].db;
  var files = db.collection('fs.files');
  files.findOne({ _id: recording.media }, function(err, thing) {
    return Checksum.create({
      filename: thing.filename,
      _file: thing._id,
      hash: thing.md5,
      type: 'md5'
    }, function() {
      recording.hash = thing.md5;
      return next();
    });
  });
});

var Person = decentral.define('Person', {
  attributes: {
    name: {
      given: { type: String , max: 30 },
      family: { type: String , max: 70 }
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

decentral.use({
  extends: {
    services: {
      http: {
        middleware: function(req, res, next) {
          console.log(req.method , req.path, req.headers);
          next();
        }
      }
    }
  }
});

decentral.start(function() {
  decentral.app.get('/search', function(req, res, next) {
    Show.query({}, function(err, shows) {
      return res.send({
        results: shows.map(function(x) {
          return {
            title: x.name
          }
        })
      });
    });
  });
});
