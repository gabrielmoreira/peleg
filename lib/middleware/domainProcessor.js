'use strict';
var Promise = require('bluebird');
var domain = require('domain');

module.exports = function(options) {
   function process(queue, content, msg, context, next) {
      return new Promise(function(resolve, reject) {
         var d = domain.create();
         d.on('error', function(e) {
            console.log("UNCAUGHT ERROR " + queue.name, e.stack);
            reject(e);
         });
         d.enter()
         next(queue, content, msg, context)
            .then(function(x) {
               resolve(x);
            })
            .catch(function (e) {
               reject(e);
            });
         d.exit();
      });
   }

   return {
      process: process
   };
}
