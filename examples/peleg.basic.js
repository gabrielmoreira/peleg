var peleg = require('..'),
	Promise = require('bluebird');

peleg.connect().then(function() {
	peleg.queue("notification:send").publish({message: "Hello World!", date: new Date()});

	peleg.queue("notification:send").process(function(data) {
		console.log("The message", "'" + data.message + "' was sent at", new Date(data.date));
		return Promise.resolve();
	})
});