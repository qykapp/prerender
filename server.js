#!/usr/bin/env node
var prerender = require('./lib');

var server = prerender({
    workers: process.env.PRERENDER_NUM_WORKERS,
    iterations: process.env.PRERENDER_NUM_ITERATIONS || 20,
    softIterations: process.env.PRERENDER_NUM_SOFT_ITERATIONS || 15,
    accessLogs: {
      filepath: process.env.PRERENDER_ACCESS_LOGS_FILE,
      format: process.env.PRERENDER_ACCESS_LOGS_FORMAT || ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ":referrer" ":user-agent"',
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
