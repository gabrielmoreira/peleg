# Peleg
A simple messaging processor for AMQP

[![npm package](https://img.shields.io/npm/v/peleg.svg?style=flat-square)](https://www.npmjs.org/package/peleg)
[![build status](https://img.shields.io/travis/gabrielmoreira/peleg/master.svg?style=flat-square)](https://travis-ci.org/gabrielmoreira/peleg)
[![dependency status](https://img.shields.io/david/gabrielmoreira/peleg.svg?style=flat-square)](https://david-dm.org/gabrielmoreira/peleg)

Installation
------------

```sh
npm install peleg --save
```

How to use
--------------------

```js
var peleg = require('peleg'),
   Promise = require('bluebird');

peleg.connect().then(function() {
   peleg.queue("notification:send").publish({message: "Hello World!"});

   peleg.queue("notification:send").process(function(data) {
      console.log("Received", data.message);
      return Promise.resolve();
   })
});

```

Samples
-------

[Basic sample](examples/peleg.basic.js)

[Multiple queue bindings](examples/peleg.binding.js)

[Advanced sample](examples/peleg.advanced.js)


Roadmap
-------

- [ ] Support two connections: Publish connection, and process connection.

- [ ] Peleg RPC:
```javascript 
peleg.call('calculator.add', 1, 2).then(function(sum) { console.log(sum); });
peleg.service('calculator.add').process(function(data) { return data[0] + data[1]});
```

