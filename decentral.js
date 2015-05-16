var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = decentral.mongoose;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var Passport = require('maki-passport-local');
var passport = new Passport({ resource: 'Person' });

var Context = require('./lib/Context');
var context = new Context();

var Torrent = require('node-torrent-stream');
var readTorrent = require('read-torrent');
var magnet = require('magnet-uri');

var crypto = require('crypto');
var stream = require('stream');

decentral.use( passport );
decentral.use( context );

var Credit = new decentral.mongoose.Schema({
  _person: { type: ObjectId , ref: 'Person', required: true },
  role: { type: String , enum: ['host', 'producer', 'guest'] , required: true }
});

var Show = decentral.define('Show', {
  attributes: {
    name:    { type: String , max: 35 , required: true , slug: true },
    created: { type: Date , default: Date.now , required: true },
    description: { type: String },
    credits:     [ Credit ],
    donations: {
      type: { type: String , enum: ['bitcoin'] },
      destination: { type: String , max: 35 }
    }
  },
  requires: {
    'Recording': {
      filter: function() {
        return { _show: this._id };
      }
    }
  },
  icon: 'unmute'
});

var Recording = decentral.define('Recording', {
  attributes: {
    _show:    { type: ObjectId , ref: 'Show', required: false , alias: 'show', populate: ['get'] },
    title:    { type: String , max: 35 , required: true , slug: true },
    subtitle: { type: String , max: 200 },
    slug:     { type: String , required: true },
    media:    { type: 'File', required: true },
    torrent:  { type: ObjectId , render: { create: false } },
    magnet:   { type: String , max: 24 , render: { create: false } },
    type:     { type: String , max: 5 , render: { create: false } },
    filename: { type: String , max: 255 , render: { create: false } },
    size:   { type: Number , render: { create: false } },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String , format: 'markdown' },
    hash: { type: String , max: 32 , render: { create: false } },
    credits:  [ Credit ],
    // TODO: remove these in favor of a "Sources" object
    youtube: { type: String },
    soundcloud: { type: String },
  },
  icon: 'sound'
});

Recording.on('query', function(next, done) {
  // TODO: evaluate a good strategy for subtitles?
  // if (!this.subtitle && this.title) this.subtitle = this.title;
});

var Source = decentral.define('Source', {
  attributes: {
    id: { type: String , max: 200 },
    type: { type: String , max: 200 },
    uri: { type: String , max: 239 } // temporary limit
  },
  icon: 'cloud'
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

Recording.post('query', function(next, done) {
  var recordings = this;
  Show.Model.populate( recordings , {
    path: '_show'
  }, function(err, populatedRecordings) {
    if (err) return done(err);
    return next( null , populatedRecordings );
  });
});

Recording.on('file:media', function(media) {
  console.log('received media:', media);

  var torrent = new Torrent({
    name: media.filename,
    trackers: config.torrents.trackers,
    webseeds: config.service.seeds.map(function(x) {
      return x + '/files/' + media._id
    })
  });
  var file = decentral.datastore.gfs.createReadStream({
    _id: media._id
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
    // TODO: point this at a local stream read
    readTorrent('http://localhost:15005/files/' + torrentFile._id , function(err, parsed) {
      if (err) console.error( err );
      var magnetURI = magnet.encode( parsed );

      Recording.patch({
        _id: media.metadata.document
      }, [
        { op: 'add', path: '/torrent' , value: torrentFile._id },
        { op: 'add', path: '/magnet' , value: magnetURI },
        { op: 'add', path: '/type' , value: media.contentType },
        { op: 'add', path: '/filename' , value: media.filename },
        { op: 'add', path: '/size' , value: media.length }
      ], function(err, num) {
        if (err) console.error( err );
        console.log('all done,', num , 'affected');
      });

    });
  });

  torrent.pipe( torrentstore );
  file.pipe( torrent );

});

Recording.pre('create', function(next, done) {
  var recording = this;
  if (!recording.media) return next();

  var db = decentral.datastore.mongoose.connections[0].db;
  var files = db.collection('fs.files');
  files.findOne({ _id: recording.media }, function(err, thing) {
    if (err) return done(err);

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

var Profile = new decentral.mongoose.Schema({
  id: { type: String , required: true },
  type: { type: String , enum: [
    'twitter',
    'github'
  ], required: true }
});

var Person = decentral.define('Person', {
  attributes: {
    name: {
      given: { type: String , max: 30 },
      family: { type: String , max: 70 }
    },
    username: { type: String , max: 35 , slug: true },
    password: { type: String , max: 70 , masked: true },
    bio: { type: String , max: 1024 },
    profiles: [ Profile ]
  },
  virtuals: {
    'name.full': function() {
      return [ this.name.given , this.name.family ].join(' ');
    }
  },
  requires: {
    'Recording': {
      filter: function() {
        return { 'credits._person': this._id };
      },
      populate: 'credits._person'
    }
  },
  icon: 'user'
});

decentral.start(function() {
  var mediaID = '55513574fda0504b5d5e7fac';
  var file = decentral.datastore.gfs.createReadStream({
    _id: mediaID
  });

  decentral.app.get('/about', function(req, res, next) {
    return res.render('about');
  });

  // TODO: internalize to maki, provide sane defaults
  decentral.app.get('/recordings/:recordingSlug/edit', function(req, res, next) {
    Recording.get({ slug: req.param('recordingSlug') }, function(err, recording) {
      Show.Model.populate(recording, {
        path: '_show'
      }, function(err, recording) {
        if (!req.user) return res.error(404);
        if (!req.user.can('edit', recording)) return res.error(404);
        return res.render('recording-edit', {
          item: recording
        });
      });
    });
  });

  decentral.app.post('/recordings/:recordingSlug', function(req, res, next) {
    Recording.update({ slug: req.param('recordingSlug') }, req.body , function(err, recording) {
      Show.Model.populate(recording, {
        path: '_show'
      }, function(err, recording) {
        if (!req.user) return res.error(404);
        if (!req.user.can('edit', recording)) return res.error(404);
        req.flash('success', 'Content edited successfully!');
        return res.redirect('/recordings/' + req.param('recordingSlug'));
      });
    });
  });

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
