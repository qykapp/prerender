/*
 * Plugin for creating access log file with morgan
 * Add `filename` and `format` during prerender start
 *
 * var server = prerender({
 *    accessLogs: {
 *      filepath: /var/logs/prerender/access.log,
 *      format: 'combined'
 *    },
 * });
 *
 * Morgan format options are listed here:
 * https://github.com/expressjs/morgan#predefined-formats
 *
 * */

var fs = require('fs');
var os = require('os');
var path = require('path');
var morgan = require('morgan');

module.exports = {
	init: function(server) {
    this.options = {
      filepath: server.options.accessLogs.filepath || path.join(os.tmpdir(), 'prerender-access.log'),
      format: server.options.accessLogs.format || 'combined',
    };
    this.stream = fs.createWriteStream(this.options.filepath, { flags: 'a' });
	},

  beforePhantomRequest: function(req, res, next) {
    morgan(this.options.format, { stream: this.stream })(req, res, next);
  }
}
