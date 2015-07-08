'use strict';

var extend = require('extend');

module.exports = function(peleg, options) {
   options = options || {};
   var suffix = options.suffix || '.success';
   var successGroup = options.successGroup || "success";
   var defaultTtl = options.ttl || 10 * 24 * 60 * 60 * 1000; // 10 dias
   var lazy = options.lazy === false ? false : true;
   if (!peleg.group(successGroup)) {
      var success = extend(true, {}, peleg.group('*'), {
         publish: {
            '*': {'expiration': defaultTtl}
         },
         forwardQueue: true
      });
      var config = {};
      config[successGroup] = success;
      peleg.configureGroups(config);
   }
   var queueNameFn = options.queueNameFn || function(queue, content, msg, context, suffix) {
      return queue.name + suffix;
   };
   var queueObjectFn = options.queueObjectFn || function(queue, content, msg, context, pResult) {
      if (context.result)
         return context.result;
      if (context.content)
         return context.content;
      /*if (pResult)
         return pResult;*/
      return content;
   };

   function process(queue, content, msg, context, next) {
      if (queue.group.forwardQueue) {
         return next(queue, content, msg, context);
      } else {
         var successQueueName = queueNameFn(queue, content, msg, context, suffix);
         var group = peleg.group(successGroup);
         if (!lazy)
            peleg.queue(successQueueName, successGroup).queue();
         return next(queue, content, msg, context).then(function(pResult) {
            var successMsg = queueObjectFn(queue, content, msg, context, pResult);
            return peleg.queue(successQueueName, successGroup).publish(successMsg);
         });
      }
   }

   return {
      process: process
   };
}
