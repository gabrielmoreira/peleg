'use strict';

var debug = require('debug'),
   util = require('util'),
   Promise = require('bluebird');

module.exports = function(options) {
   options = options || {};
   var label = options.label || 'peleg:log';
   var log = options.log || debug(label);
   var truncateLimit = options.truncateLimit || 100;
   var truncate = options.truncate || function(content) {
      if (!content) return content;
      try {
         var type = typeof(content);
         if (type !== 'string' && type !== 'object') return content;
         if (type === 'object') content = JSON.stringify(content);
         return content.substring(0, truncateLimit) + (content.length > truncateLimit ? "..." : "");
      } catch (e) {
         return content;
      }
   }

   var publishLog = options.publish || function publish(queue, content, options) {
      log(util.format('publishing on %s: %s', queue.name, truncate(content)));
   };
   var processLog = options.process || function process(queue, content, msg, context) {
      try {
         content = queue.content(msg);
      } catch (e) {}
      log(util.format('processing on %s: %s', queue.name, truncate(content)));
   };
   var processErrorLog = options.processError || function process(queue, content, msg, context, e) {
      log(e, util.format('error processing %j from %s. Error: %s', content, queue.name, e));
   };

   function publish(queue, content, options, next) {
      publishLog(queue, content, options);
      return next(queue, content, options)
   }

   function process(queue, content, msg, context, next) {
      processLog(queue, content, msg, context);
      return next(queue, content, msg, context).catch(function(e) {
         processErrorLog(queue, content, msg, context, e);
         return Promise.reject(e);
      });
   }

   return {
      process: process,
      publish: publish
   };
}
