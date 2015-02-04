# metastream

Allows you to attach metadata (an object that can be JSONified) to streams.

This is an alternative to, for example, just encoding binary data with base64
and sending everything as JSON.  base64 uses about 33% more bandwidth so this
will avoid that.

Here are a few usage examples in one of my current projects:

* Transmitting files for backup, currently using protocol buffers to send filename etc. along with data, metastreams would also work fine.

* Relay/proxy system for a home server behind a router doing NAT, single connection multiplexing multiple connects, sending socket ID along with data.

```javascript
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

```

