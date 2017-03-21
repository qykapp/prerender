var cacheManager = require('cache-manager');
var os = require('os')
var fs = require('fs-extra');
var path = require('path');
var url = require('url');
var sanitize = require("sanitize-filename");
var moment = require('moment');

module.exports = {
  init: function() {
    this.cache = cacheManager.caching({
      store: fs_store
    });
  },

  beforePhantomRequest: function(req, res, next) {

    // Earlier, a HEAD request was sent to force refesh cache.
    // We have implemented a more comprehensive logic for cache refresh,
    // and are passing different headers in GET request itself to cater to that.

    // if (req.method !== 'GET') {
    //   return next();
    // }

    let query = {
      key: req.prerender.url,
    };

    let refreshOnly = false;
    if (req.headers && "x-prerender-refresh-cache" in req.headers) {
      refreshOnly = true;
      query.ttlMax = 60*60*24*25; /*seconds*/
      query.ttlMin = 60*60*12; /*seconds*/
      if ("x-last-modified" in req.headers) {
        query.lastModified = moment(req.headers['x-last-modified'], moment.ISO_8601);
      }
    }
    this.cache.get(query, function (err, result) {
      req.prerender.responseSent = false;

      // in case of error or no result,
      // let phantomjs fetch and send response
      if (err || !result) return next();

      if (refreshOnly) {
        if (result.noRefreshCache)
          return res.send(200, JSON.stringify({ status: 'CACHE_VALID'}));
        return next();
      }

      // if we don't need to refresh cache,
      // send cached result and exit
      if (result.noRefreshCache) {
        return res.send(200, result.body);
      }

      // we can send cached result,
      // but we also need to refresh the existing cache for next time
      req.prerender.responseSent = true;
      res.send(200, result.body);
      return next();
    });
  },

  afterPhantomRequest: function(req, res, next) {
    // if the response is already sent we dont want to send again
    // this is just an extra precaution, the logic below should not call
    // _next if the response is already sent
    var _next = !req.prerender.responseSent ? next : function(){console.error("### NEVER_ERROR ###  This error should never come.");};


    let refreshOnly = false;
    if (req.headers && "x-prerender-refresh-cache" in req.headers) {
      refreshOnly = true;
    }

    // if we did not get a valid 200 response from upstream, we cant cache anything
    if(req.prerender.statusCode !== 200) {
      // if its a cache refresh request, send a failure response and exit
      if (refreshOnly)
        return res.send(500, JSON.stringify({ status: 'FAILED', error: 'BAD_UPSTREAM_RESPONSE'}));
      // if response is already sent, no need to call next()
      if(!req.prerender.responseSent) return _next();
      else return;
    }

    // refresh the cache
    this.cache.set(req.prerender.url, req.prerender.documentHTML);

    if (refreshOnly) {
      return res.send(200, JSON.stringify({ status: 'CACHE_REFRESHED'}));
    }

    // if response is already sent, no need to call next()
    if(!req.prerender.responseSent) return _next();
    else return;
  }
};


// Cache Logic:
// - default state is to refresh cache for every page on request
// - if there is a cache already existing, serve that and refresh cache
// - dont refresh cache if its age < CACHE_TTL_MIN
// - dont serve the cache if its age > CACHE_TTL_MAX
// - definitely refresh the cache if filetime < query.lastModified
var fs_store = {
  get: function(query, callback) {
    var ttlMax = query.ttlMax || process.env.CACHE_TTL_MAX || 60*60*24*30; /*seconds*/
    var ttlMin = query.ttlMin || process.env.CACHE_TTL_MIN || 60*60*24; /*seconds*/
    var filepath = getFilepath(query.key);

    if (!fs.existsSync(filepath)) return callback(false, null);

    var noRefreshCache = false;
    var date = new Date();
    var filetime = fs.statSync(filepath).mtime.getTime();
    if (date.getTime() - filetime > ttlMax * 1000) {
      return callback(false, null);
    }

    // definitely recache if filetime < query.lastModified
    if (query.lastModified && filetime < query.lastModified) {
      noRefreshCache = false;
    }
    // dont recache if cache was created within ttlMin
    else if (date.getTime() - filetime < ttlMin * 1000) {
      noRefreshCache = true;
    }

    fs.readFile(filepath, function(err, data) {
      if (err) return callback(err);
      var result = {
        noRefreshCache: noRefreshCache,
        body: data
      };
      return callback(null, result);
    });
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

