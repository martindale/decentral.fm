var Maki = require('maki');
var config = require('./config');
var decentral = new Maki( config );

var mongoose = decentral.mongoose;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var Passport = require('maki-passport-local');
var passport = new Passport({ resource: 'Person' });

var PassportSoundcloud = require('maki-passport-soundcloud');
var passportSoundcloud = new PassportSoundcloud({
  resource: 'Person',
  path: '/profiles/soundcloud',
  multi: true
});

var Context = require('./lib/Context');
var context = new Context();

var Torrent = require('node-torrent-stream');
var readTorrent = require('read-torrent');
var magnet = require('magnet-uri');
var _ = require('lodash');

var crypto = require('crypto');
var stream = require('stream');

decentral.use( passport );
decentral.use( passportSoundcloud );
decentral.use( context );

var Credit = new decentral.mongoose.Schema({
  _person: { type: ObjectId , ref: 'Person', required: true },
  role: { type: String , enum: ['host', 'producer', 'guest'] , required: true }
});

var SoundcloudProfile = new decentral.mongoose.Schema({
  id: { type: String , required: true },
  username: { type: String },
  token: { type: String }
});

var Show = decentral.define('Show', {
  attributes: {
    name:    { type: String , max: 35 , required: true , slug: true },
    created: { type: Date , default: Date.now , required: true },
    description: { type: String },
    _creator: { type: ObjectId , ref: 'Person' },
    _owner: { type: ObjectId , ref: 'Person' },
    credits:     [ Credit ],
    donations: {
      type: { type: String , enum: ['bitcoin'] },
      destination: { type: String , max: 35 }
    },
    settings: {
      soundcloud: {
        enabled: { type: Boolean , default: true },
        token: { type: String }
      }
    },
    profiles: {
      soundcloud: {
        id: { type: String },
        username: { type: String },
        token: { type: String }
      }
    }
  },
  requires: {
    'Recording': {
      filter: function() {
        return { _show: this._id };
      }
    },
    'Person': {
      // TODO: implement local aliases in Maki
      alias: 'editors',
      filter: function() {
        var self = this;
        if (!self.credits) self.credits = [];
        return { _id: { $in: self.credits.map(function(c) {
          return c._person;
        }) } }
      }
    }
  },
  icon: 'unmute'
});

Show.pre('update', function(next, done) {
  var params = this;
  if (!params.profiles || !params.profiles.soundcloud) return next();

  if (params.profiles.soundcloud === 'disable') {
    params.profiles.soundcloud = {
      id: null,
      username: null,
      token: null
    };
    return next();
  }

  var validObject = mongoose.mongo.BSONPure.ObjectID.isValid( params.profiles.soundcloud );
  if (validObject) {
    Person.get({ 'profiles.soundcloud._id': params.profiles.soundcloud }, function(err, person) {
      var soundclouds = person.profiles.soundcloud;
      var profile = _.find( soundclouds , function(s) {
        return (s._id.toString() === params.profiles.soundcloud);
      });

      profile.id = profile._id.toString();
      params.profiles.soundcloud = profile.toObject();

      next();

    });
  } else {
    return done('invalid object in profiles field');
  }
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
    comments: [ { type: ObjectId , ref: 'Comment' , render: { create: false } } ],
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

var Comment = decentral.define('Comment', {
  attributes: {
    _author: { type: ObjectId , ref: 'Person' , required: true },
    _parent: { type: ObjectId , ref: 'Comment' },
    created: { type: Date , default: Date.now , required: true },
    message: { type: String , required: true }
  },
  // TODO: Comment.contexts.html.on('create', ... )
  // or:   Comment.on('create', {
  //         context: 'html',
  //       }, function() { ... });
  // TODO: authorization endpoints
  /* handlers: {
    html: {
      create: function(req, res, next) {
        if (!req.user) return next();
        var comment = this;
        // TODO: how to attach author automatically to resources like this?
        // do this in Maki proper, for sure.  Request contexts?
      }
    }
  }, */
  icon: 'comment'
});

/* Comment.pre('create', function(next, done) {
  var comment = this;
}); */

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

  // TODO: make this an event listener.
  // this would totally work in Rethink!
  setTimeout( findMedia , 10000); // media event happens before document is created

  function findMedia() {
    Recording.query({ media: media._id }, function(err, recordings) {
      if (err) console.error(err);
      // TODO: troubleshoot why created files don't have the correct Recording ID.
      // media.metadata.document
      console.log('looking for media:', media._id);
      var recording = recordings[0];
      if (!recording) return console.error('no document found.');

      var fs = require('fs');
      var http = require('https');

      var file = decentral.datastore.gfs.createReadStream({
        _id: media._id
      });
      //file.pause();
      var bufs = [];
      file.on('data', function(b) {
        bufs.push(b);
      });
      file.on('end', function() {
        Show.get({ _id: recording._show }, function(err, show) {
          var buf = Buffer.concat( bufs );
          var boundaryKey = require('crypto').randomBytes(16).toString('hex');

          var data = {
            'track[sharing]': 'public',
            'oauth_token': show.profiles.soundcloud.token,
            'track[title]': recording.title,
            'track[description]': recording.description
          };

          var body = '--' + boundaryKey + '\r\n';
          Object.keys( data ).forEach(function(k) {
            body += 'Content-Disposition: form-data; name="' + k + '"\r\n\r\n';
            body += data[k] + '\r\n';
            body += '--' + boundaryKey + '\r\n';
          });

          body += 'Content-Disposition: form-data; name="track[asset_data]"; filename="'+media.filename+'"\r\n\r\n';
          //body += 'Content-Type: application/octet-stream\r\n\r\n';
          body += buf.toString('binary'); // THEN we convert to binary?  wtf?
          body += '\r\n--' + boundaryKey + '--\r\n';

          var request = http.request({
            host: 'api.soundcloud.com',
            port: 443,
            path: '/tracks',
            method: 'POST',
            headers: {
              'host': 'api.soundcloud.com',
              'content-length': Buffer.byteLength( body ).toString(),
              'accept-encoding': 'gzip, deflate',
              'accept': '*/*',
              'user-agent': 'SoundCloud Python API Wrapper 0.4.1',
              'content-type': 'multipart/form-data; boundary=' + boundaryKey
            }
          }, function(res) {
            console.log('finally!');
            console.log(res.req._headers);
            console.log(res.statusCode);
            console.log('soundcloud creation:', res.statusCode , res.headers);
          });

          request.on('error', function(err) { console.error('request error: ' + err); });

          request.write(body);
          request.end();
        });
      });

      //file.resume({ end: false });
      file.resume();
    });
  }
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

var Person = decentral.define('Person', {
  attributes: {
    name: {
      given: { type: String , max: 30 },
      family: { type: String , max: 70 }
    },
    username: { type: String , max: 35 , slug: true },
    password: { type: String , max: 70 , masked: true },
    bio: { type: String , max: 1024 },
    //profiles: [ Profile ]
    profiles: {
      soundcloud: [ SoundcloudProfile ]
    }
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
