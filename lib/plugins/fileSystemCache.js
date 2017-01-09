var cacheManager = require('cache-manager');
var os = require('os')
var fs = require('fs-extra');
var path = require('path');
var url = require('url');
var sanitize = require("sanitize-filename");

module.exports = {
  init: function() {
    this.cache = cacheManager.caching({
      store: fs_store
    });
  },

  beforePhantomRequest: function(req, res, next) {
    if (req.method !== 'GET') {
      return next();
    }

    this.cache.get(req.prerender.url, function (err, result) {
      if (!err && result) {
        req.prerender.fileSystemCached = true;
        return res.send(200, result);
      }
      return next();
    });
  },

  afterPhantomRequest: function(req, res, next) {
    if(req.prerender.statusCode !== 200) {
      return next();
    }
    if (!req.prerender.fileSystemCached) {
      this.cache.set(req.prerender.url, req.prerender.documentHTML);
    }
    return next();
  }
};


var fs_store = {
  get: function(key, callback) {
    var ttl = process.env.CACHE_TTL || 3600; /*seconds*/
    var filepath = getFilepath(key);

    if (!fs.existsSync(filepath)) {
      return callback(false, null);
    }

    var date = new Date();
    if (date.getTime() - fs.statSync(filepath).mtime.getTime() > ttl * 1000) {
      return callback(false, null);
    }

    fs.readFile(filepath, callback);
  },
  set: function(key, value, callback) {
    var filepath = getFilepath(key);
    var filedir = path.dirname(filepath);

    if (!fs.existsSync(filedir)) {
      fs.mkdirsSync(filedir, '0777', true);
    }

    fs.writeFile(filepath, value, callback);
  }
};

var getFilepath = function (requestUrl) {
  var filedir = process.env.CACHE_ROOT_DIR || path.join(os.tmpdir(), "prerender-cache");
  var filename = 'prerender.cache.html';
  var reqUrl = url.parse(requestUrl);

  if (reqUrl.pathname && reqUrl.pathname !== '/') {
    // parse the URL path and join it with the cache base path
    filedir = path.join(filedir, path.format(path.parse(reqUrl.pathname)));
    if (reqUrl.query) {
      // a query is set, join this as well
      filedir = path.join(filedir, sanitize(reqUrl.query));
    }
  }

  return path.join(filedir, filename);
};

