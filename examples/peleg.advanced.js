var peleg = require('..'),
   Promise = require('bluebird');

process.env.DEBUG='*';
// Automatic log in/out messages
peleg.use(require('../lib/middleware/logger.js')());
// Automatic send all success processed messages to ${queueName}.success with ttl: 10 days
peleg.use(require('../lib/middleware/successProcessor.js')(peleg));
// Automatic send all failed processed messages to ${queueName}.error with ttl: 30 days
peleg.use(require('../lib/middleware/errorProcessor.js')(peleg));
// Automatic capture unhandled exceptions
peleg.use(require('../lib/middleware/domainProcessor.js')());

peleg.connect().then(function() {
   peleg.queue("notification:send").publish({message: "Hello World!", date: new Date()});
   peleg.queue("notification:send").publish({message: "Some error", date: new Date()});
   peleg.queue("notification:send").publish({message: "Unhandled error", date: new Date()});

   peleg.queue("notification:send").process(function(data) {
      var result = Promise.resolve();
      // Success test case
      console.log("The message", "'" + data.message + "' was sent at", new Date(data.date));
      // Rejected test case
      if (data.message === "Some error") return Promise.reject(data);
      // Unhandled async error test case
      if (data.message === "Unhandled error") {
         setTimeout(function() {
            throw new Error("Unhandled");
         }, 20);
         result = result.delay(200); // add some delay to mock async data...
      }
      return result;
   })
});
