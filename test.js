net = require('net');
Metastream = require('./index');

var server = net.createServer(function(c) {
  console.log('server recvd conn');
  var outp = new Metastream(c);
  outp.write({id: 'bob'}, new Buffer('Bob Test'));
  console.log('server wrote data');
  outp.on(function(meta, data) {
    console.log('server recvd from ' + meta.id + ': ' + data.toString());
  });
});

server.listen(6345);
console.log('Server listening');

var client = net.connect({port: 6345}, function() {
  console.log('client connected to server');
  var conn = new Metastream(client);
  conn.on(function(meta, data) {
    console.log('client recvd from ' + meta.id + ': ' + data.toString());
    conn.write({id: 'tom'}, new Buffer("Tom received data " + data.toString() + ' back at yah'));
    conn.write({id: 'ed'}, new Buffer('Hey'));
    var bigStr = '';
		for (var x=0; x<1000; x++) {
      bigStr += '0123456789';
		}
		bigStr = '[START]'+bigStr+'[END]';
		conn.write({id:'big'}, new Buffer(bigStr));
	});
});


