var peleg = require('..'),
   Promise = require('bluebird');

peleg.connect().then(function() {
   // Bind queue "log:notification" to "notification:send"
   peleg.queue('log:notification').bind('notification:send');

   // Send a new notification
   peleg.queue("notification:send").publish({message: "Hello World!", date: new Date()});

   // Receiving notification
   peleg.queue("notification:send").process(function(data) {
      console.log("The message", "'" + data.message + "' was sent at", new Date(data.date));
      return Promise.resolve();
   })

   // Logging notification
   peleg.queue("log:notification").process(function(data) {
      console.log("Send notification to log", data);
      return Promise.resolve();
   });
});
