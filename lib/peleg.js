'use strict';

var Promise = require('bluebird');
var amqp = require('./amqp.js');
var extend = require('extend');
var Queue = require('./queue.js');
var compat = require('./compat.js');

var defaultOptions = {
   groups: {
      '*': {
         queue: {
            '*': {
               'durable': 'true'
            }
         },
         exchange: {
            '*': {
               'type': 'topic'
            }
         },
         publish: {
            '*': {
            }
         }
      },
      'bus': {
         queue: {
            '*': {
               'durable': 'true'
            }
         },
         exchange: {
            '*': {
               'type': 'fanout'
            }
         },
         publish: {
            '*': {
            }
         }
      },
      'temporary': {
         publish: {
            '*': {
               'expiration': 30 * 24 * 60 * 60 * 1000 // 30 days = 30 * 24 hours * 60 minutes * 60 seconds * 1000 millis
            }
         }
      }
   }
};

function Peleg() {
   if (!(this instanceof Peleg)) return new Peleg;
   extend(true, this, defaultOptions);
   this._queues = [];
   this._publishMiddleware = [];
   this._processMiddleware = [];
}

var peleg = Peleg.prototype;

peleg.connect = function connect(url, socketOptions) {
   var self = this;
   return amqp.connect(url, socketOptions).then(function(connection) {
      connection.createConfirmChannel = compat.fromWhenFn(connection.createConfirmChannel);
      self._connection = connection;
      return self;
   });
};

peleg.configure = function configure(options) {
   extend(true, this, defaultOptions, options || {});
};

peleg.configureGroups = function configureGroups(groups) {
   extend(true, this.groups, defaultOptions.groups, groups || {});
};

peleg.use = function use(middleware) {
   if (middleware.publish) this._publishMiddleware.push(middleware.publish);
   if (middleware.process) this._processMiddleware.push(middleware.process);
   return this;
}

peleg.init = function init(urlOrSocketOptions, configureOptions) {
   this.configure(configureOptions);
   return this.connect(urlOrSocketOptions);
};

peleg.queue = function queue(name, group) {
   return this._queues[name] = this._queues[name] || new Queue(this, name, group);
};

peleg.group = function group(name) {
   return this.groups[name];
}

peleg.runMiddleware = function runMiddleware(type, target, args, options) {
   options = extend({pre: [], post: []}, options);
   var fns = [].concat(options.pre).concat(this["_" + type + "Middleware"]).concat([target]).concat(options.post);
   fns = fns.map(function(fn) {
      return Promise.method(fn);
   });
   var max = args.length;
   var next = function next(nextFns) {
      var nargs = Array.prototype.slice.call(arguments, 1, max + 1);
      var nextFn = nextFns.shift();
      if (nextFns.length)
         nargs.push(next.bind(this, nextFns));
      return nextFn.apply(this, nargs);
   };
   return next.bind(this, fns).apply(this, args);
};

peleg.clearMiddlewares = function clearMiddlewares() {
   this._publishMiddleware = [];
   this._processMiddleware = [];
}

exports = module.exports = Peleg;
