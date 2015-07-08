'use strict';

var extend = require('extend');
var Promise = require('bluebird');

function stringifyError(err, filter, space) {
   if (!err)
      return null;
   try {
      var plainObject = {};
      Object.getOwnPropertyNames(err).forEach(function(key) {
         plainObject[key] = err[key];
      });
      return JSON.stringify(plainObject, filter, space);
   } catch (e) {
      return err.message;
   }
};

module.exports = function(peleg, options) {
   options = options || {};
   var suffix = options.suffix || '.error';
   var errorGroup = options.errorGroup || "error";
   var defaultTtl = options.ttl || 30 * 24 * 60 * 60 * 1000; // 30 dias
   var addMsg = options.addMsg;
   var lazy = options.lazy === false ? false : true;
   if (!peleg.group(errorGroup)) {
      var error = extend(true, {}, peleg.group('*'), {
         publish: {
            '*': {'expiration': defaultTtl}
         },
         forwardQueue: true
      });
      var config = {};
      config[errorGroup] = error;
      peleg.configureGroups(config);
   }
   var queueNameFn = options.queueNameFn || function(queue, content, msg, context, suffix) {
      return queue.name + suffix;
   };
   var queueObjectFn = options.queueObjectFn || function(queue, content, msg, context, e) {
      var result = {
         error: stringifyError(e),
         errorMessage: e.message,
         content: context.content || content
      }
      if (addMsg)
         result.msg = msg;
      return result;
   };

   function process(queue, content, msg, context, next) {
      if (queue.group.forwardQueue) {
         return next(queue, content, msg, context);
      } else {
         var errorQueueName = queueNameFn(queue, content, msg, context, suffix);
         var group = peleg.group(errorGroup);
         if (!lazy)
            peleg.queue(errorQueueName, errorGroup).queue();
         return next(queue, content, msg, context).catch(function(e) {
            var errorMsg = queueObjectFn(queue, content, msg, context, e);
            return peleg.queue(errorQueueName, errorGroup).publish(errorMsg).then(function() {
               context.ignoreError = true;
               return Promise.reject(e);
            });
         });
      }
   }

   return {
      process: process
   };
}
