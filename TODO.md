## TO-DO

[ ] Support two connections: Publish connection, and process connection.

[ ] Peleg RPC:
peleg.call('calculator.add', 1, 2).then(function(sum) { console.log(sum); });
peleg.service('calculator.add').process(function(data) { return data[0] + data[1]});

[ ] Remove group feature from peleg

