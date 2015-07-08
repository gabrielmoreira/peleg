'use strict';

var Promise = require('bluebird');
var compat = require('./compat.js');
var extend = require('extend');

function Queue(peleg, name, groupName) {
   this.peleg = peleg;
   this.name = name;
   var tokens = name.split(':');
   if (tokens.length !== 2) throw new Error("Queue name must have exchange:routingKey");
   this.exchangeName = tokens[0];
   this.routingKey = tokens[1];
   this.groupName = groupName || '*';
   this.group = peleg.group(groupName) || peleg.group('*');
   this.queueConfig = this.group.queue[name] || this.group.queue['*'];
   this.publishConfig = this.group.publish[name] || this.group.publish['*'];
   this.exchangeConfig = this.group.exchange[this.exchangeName] || this.group.exchange['*'];
};

var queue = Queue.prototype;

queue.channel = function channel() {
   var self = this;
   if (self._channel)
      return Promise.resolve(self._channel);
   return self.peleg._connection.createConfirmChannel()
      .then(function(_channel) {
         compat.fromWhenFnAll(_channel, ['assertQueue', 'consume', 'publish']);
         self._channel = _channel;
      });
};

queue.content = function content(msg) {
   var contentType = msg.properties.contentType;
   if (contentType === 'application/json')
      return JSON.parse(msg.content.toString());
   else if (contentType === 'text/plain')
      return msg.content.toString();
   return msg.content;
};

queue.queue = function queue() {
   var self = this;
   if (self._queue)
      return Promise.resolve(self._queue);
   return self.channel()
      .then(function() {
         return self._channel.assertQueue(self.name, self.queueConfig)
      }).then(function(queueStats) {
         self._queue = queueStats;
         return queueStats;
      });
};

queue.bind = function bind(name) {
   var self = this;
   var queue = self.peleg.queue(name);
   return Promise.join(self.queue(), queue.exchange(), function() {
      self._channel.bindQueue(self.name, queue.exchangeName, queue.routingKey);
      return self;
   });
};

queue.exchange = function exchange() {
   var self = this;
   if (self._exchange)
      return Promise.resolve(self._exchange);
   var queue = self.queue();
   return self.channel()
      .then(function() {
         return self._channel.assertExchange(self.exchangeName, self.exchangeConfig.type, self.exchangeConfig)
      }).then(function(exchangeStats) {
         self._exchange = exchangeStats;
         return queue;
      }).then(function() {
         return self._channel.bindQueue(self.name, self.exchangeName, self.routingKey);
      });
};

queue.process = function process(processor, options) {
   var self = this;
   return self.queue()
      .then(function() {
         return self._channel.consume(self.name, function(msg) {
            function do_process(queue, content, msg, context) {
               var p = null;
               try {
                  content = queue.content(msg);
                  context.content = content;
                  p = processor(content, msg, context);
               } catch (e) {
                  p = Promise.reject(e);
               }
               if (!p)
                     throw new Error("Processor must return a promise");
               return p.then(function(r) {
                  if (context.ackOnComplete) context.ack();
                  return p;
               }).catch(function(e) {
                  if (context.ackOnComplete) context.ack();
                  return Promise.reject(e);
               });
            }
            var ack = function() {
               self._channel.ack(msg);
            };
            var context = {
               ack: ack,
               ackOnComplete: true
            };
            var p = self.peleg.runMiddleware('process', do_process, [self, msg.content, msg, context]);
            p.catch(function(e) {
               if (context.ignoreError)
                  return e;
               return Promise.reject(e);
            });
         });
      });
};

queue.publish = function publish(msg, options) {
   var self = this;
   return self.exchange()
      .then(function() {
         options = extend(true, {}, self.publishConfig || {}, options || {});
         function do_publish(queue, msg, options) {
            if (!(msg instanceof Buffer)) {
               if (typeof(msg) === 'string') {
                  options.contentType = 'text/plain';
               } else if (typeof(msg) === 'object') {
                  options.contentType = 'application/json';
                  msg = JSON.stringify(msg);
               }
               msg = new Buffer(msg);
            }
            return queue._channel.publish(queue.exchangeName, queue.routingKey, msg, options);
         }
         return self.peleg.runMiddleware('publish', do_publish, [self, msg, options]);
      });
};

exports = module.exports = Queue;
