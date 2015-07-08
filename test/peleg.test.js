var assert = require('better-assert');
var Promise = require('bluebird');
var peleg = require('../lib');

function end(done, fn) {
   try {
      var skip = false;
      fn(function() {
         skip = true;
      });
      if (!skip)
         done();
   } catch (e) {
      done(e);
   }
}

describe('peleg', function() {
   it('can connect', function(done) {
      peleg.connect().nodeify(done);
   });

   it('can configure queue groups', function(done) {
      assert(peleg.groups['*'].exchange['*'].type === 'topic');

      peleg.configureGroups({
         'event': {
            exchange: {
               '*': {
                  'type': 'fanout'
               }
            }
         }
      });

      assert(peleg.groups['event'].exchange['*'].type === 'fanout');
      done();
   });

   describe('when connected', function() {

      it('can publish', function(done) {
         peleg.queue('test:process.queue2')
            .publish('abc')
            .nodeify(done);
      });

      it('can process strings', function(done) {
         peleg.queue('test:process.queue')
            .publish('abc');

         peleg.queue('test:process.queue')
            .process(function(content, msg) {
               end(done, function() {
                  assert(content.toString() === 'abc');
               })
               return Promise.resolve();
            });
      });

      it('can process json', function(done) {
         var count = 3;
         peleg.queue('test:process.json')
            .publish({
               a: 1
            })
            .then(function() {
               return peleg
                  .queue('test:process.json')
                  .publish({
                     a: 1
                  })
                  .then(function() {
                     return peleg.queue('test:process.json')
                        .publish({
                           a: 1
                        });
                  });
            });

         peleg.queue('test:process.json')
            .process(function(content, msg) {
               end(done, function(skip) {
                  count--;
                  assert(msg.properties.contentType === 'application/json');
                  assert(content.a === 1);
                  if (count !== 0)
                     skip();
               });
               return Promise.resolve();
            });
      });

      it('can bind to multiple exchanges', function(done) {
         peleg.queue('test:multiple.exchanges.a')
            .bind('test:multiple.exchanges.b');

         peleg.queue('test:multiple.exchanges.a')
            .process(function(content) {
               end(done, function() {
                  assert(content === 'hello');
               });
               return Promise.resolve();
            });

         peleg.queue('test:multiple.exchanges.b')
            .publish('hello');
      });

      it('can use publish middlewares', function(done) {
         peleg.use({
            'publish': function publish(queue, content, options, next) {
               return next(queue, content + ".ok", options);
            }
         });

         peleg.use({
            'publish': function publish(queue, content, options, next) {
               return next(queue, content + "?", options);
            }
         });

         peleg.queue('test:publish.middlewares')
            .publish('abc');

         peleg.queue('test:publish.middlewares')
            .process(function(content) {
               end(done, function() {
                  assert(content.toString() === 'abc.ok?');
               });
               return Promise.resolve();
            });
      });

      beforeEach(function() {
         peleg.clearMiddlewares();
      });

      it.skip('can use process middlewares', function(done) {
         var count = 0;
         peleg.use({
            'process': function process(queue, content, msg, context, next) {
               count++;
               return next(queue, content, msg, context);
            }
         });

         peleg.use({
            'process': function process(queue, content, msg, context, next) {
               count++;
               context.ackOnComplete = false;
               return next(queue, content, msg, context)
                  .then(function() {
                     context.ack();
                  });
            }
         });

         peleg.queue('test:process.middlewares')
            .publish('abc');

         peleg.queue('test:process.middlewares')
            .process(function(content) {
               end(done, function() {
                  assert(count === 2);
               });
               return Promise.resolve();
            });
      });

      it.skip('can handle errors with middlewares', function(done) {
         var count = 0;
         peleg.use({
            'process': function process(queue, content, msg, context, next) {
               count++;
               context.ackOnComplete = false;
               return next(queue, content, msg, context)
                  .catch(function() {
                     context.ack();
                     end(done, function() {
                        assert(count === 1);
                     });
                  });
            }
         });

         peleg.queue('test:errors.middlewares')
            .publish('abc');

         peleg.queue('test:errors.middlewares')
            .process(function(content) {
               throw new Error("Some error!");
            });
      });

      it.skip('can use logger middleware', function(done) {
         var logger = require('../lib/middleware/logger.js');
         var msgs = [];
         peleg.use(logger({
            log: msgs.push.bind(msgs)
         }));

         peleg.queue('test:logger.middleware')
            .publish('abc');

         peleg.queue('test:logger.middleware')
            .process(function(content) {
               end(done, function() {
                  assert(content.toString() === 'abc');
                  assert(msgs[0] === 'sending "abc" to test:logger.middleware');
                  assert(msgs[1] === 'received "abc" from test:logger.middleware');
               });
               return Promise.resolve();
            });
      });

      it.skip('can use errorProcessor middleware', function(done) {
         var errorProcessor = require('../lib/middleware/errorProcessor.js');
         var msgs = [];
         peleg.use(errorProcessor(peleg, {
            lazy: false
         }));

         peleg.queue('test:errorProcessor.middleware')
            .publish('abc');

         peleg.queue('test:errorProcessor.middleware')
            .process(function(content) {
               throw new Error("What!?");
            }).then(function() {
               peleg.queue('test:errorProcessor.middleware.error')
                  .process(function(content) {
                     end(done, function() {
                        assert(content.errorMessage === 'What!?');
                     });
                     return Promise.resolve();
                  })
            });
      });

      it.skip('can use successProcessor middleware', function(done) {
         var successProcessor = require('../lib/middleware/successProcessor.js');
         var msgs = [];
         peleg.use(successProcessor(peleg, {
            lazy: false
         }));

         peleg.queue('test:successProcessor.middleware')
            .publish('abc');

         peleg.queue('test:successProcessor.middleware')
            .process(function(content) {
               return Promise.resolve();
            }).then(function() {
               peleg.queue('test:successProcessor.middleware.success')
                  .process(function(content) {
                     end(done, function() {
                        assert(content === 'abc');
                     });
                     return Promise.resolve();
                  })
            });
      });

      it.skip('can use domainProcessor middleware', function(done) {
         var errorProcessor = require('../lib/middleware/errorProcessor.js');
         var domainProcessor = require('../lib/middleware/domainProcessor.js');
         var msgs = [];
         peleg.use(errorProcessor(peleg, {
            lazy: false
         }));
         peleg.use(domainProcessor());

         peleg.queue('test:domainProcessor.middleware')
            .publish('abc');

         peleg.queue('test:domainProcessor.middleware')
            .process(function(content) {
               console.log("processando!");
               return new Promise(function(resolve) {
                  setTimeout(function() {
                     throw new Error("What!?");
                  }, 10);
               });
            }).then(function() {
               peleg.queue('test:domainProcessor.middleware.error')
                  .process(function(content, msg) {
                     console.log("error middleware");
                     end(done, function() {
                        console.log(msg);
                        assert(content.errorMessage === 'What!?');
                     });
                     return Promise.resolve().nodeify(done);
                  })
            });
      });

   });
});
