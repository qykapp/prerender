#!/usr/bin/env node
var prerender = require('./lib');
var os = require('os')
var path = require('path');

var server = prerender({
  workers: process.env.PRERENDER_NUM_WORKERS,
  iterations: process.env.PRERENDER_NUM_ITERATIONS || 20,
  softIterations: process.env.PRERENDER_NUM_SOFT_ITERATIONS || 15,
  accessLogs: {
    filepath: process.env.PRERENDER_ACCESS_LOGS_FILE,
    format: process.env.PRERENDER_ACCESS_LOGS_FORMAT || ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ":referrer" ":user-agent"',
  },
  // http://phantomjs.org/api/command-line.html
  phantomArguments: {
    '--load-images': false,
    '--ignore-ssl-errors': true,
    '--ssl-protocol': 'tlsv1.2',
    '--disk-cache': true,
    '--disk-cache-path': process.env.ASSETS_CACHE_DIR || path.join(os.tmpdir(), "prerender-cache/.assets"),
    '--max-disk-cache-size': 10000000,
  },
});


server.use(prerender.accessLogs());
server.use(prerender.sendPrerenderHeader());
// server.use(prerender.basicAuth());
// server.use(prerender.whitelist());
server.use(prerender.blacklist());
// server.use(prerender.logger());
server.use(prerender.removeScriptTags());
server.use(prerender.httpHeaders());
// server.use(prerender.inMemoryHtmlCache());
// server.use(prerender.s3HtmlCache());
server.use(prerender.fileSystemCache());

server.start();
