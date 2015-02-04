net = require('net');
metastream = require('./metastream');

var server = net.createServer(function(c) {
  var outp = metastream(c);
  outp.write({id: 'bob'}, new Buffer('Bob Test'));
  outp.on(function(meta, data) {
    console.log('server recvd from ' + meta.id + ': ' + data.toString());
  });
});

server.listen(6345);

var client = net.connect({port: 6345}, function() {
  var conn = metastream(client);
  conn.on(function(meta, data) {
    console.log('client recvd from ' + meta.id + ': ' + data.toString();
    conn.write({id: 'tom'}, "Tom received data " + data.toString() + ' back at yah');
  });
});


