'use strict';

var Promise = require('bluebird');

var compat = {
   fromWhen: function fromWhen(p) {
      return new Promise(function(resolve, reject) {
         p.done(resolve, reject);
      });
   },

   fromWhenFn: function fromWhenFn(fn) {
      var self = this;
      return function() {
         var args = Array.prototype.slice.call(arguments);
         return compat.fromWhen(fn.apply(this, args));
      }
   },

   fromWhenFnAll: function fromWhenFnAll(obj, names) {
      names = names || Object.keys(names)
      for (var name in names) {
         obj[name] = compat.fromWhenFn(obj[name]);
      }
   }
}

exports = module.exports = compat;
