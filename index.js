
module.exports = function(stream) {
  var self = this;
  self.stream = stream;

  self.on = function(cb) {
    self.onData = cb;
  }

  function firstProp(obj) {
    return obj[Object.keys(obj)[0]];
  }

  var parts =
    [ { 'totalLength': 4 },
      { 'jsonLength': 2 },
      { 'json': Infinity },
      { 'data': Infinity } ];

  var _partName = null,
      _pos = 0,
      _fullBuffer = new Buffer(''),
      _partNum = Infinity,
      _remaining = Infinity,
      _buffer = null;

  function nextPart() {
    if (_partNum === Infinity) {
      _partNum = 0;
    } else {
      _partNum += 1;
      _part = parts[_partNum];
      _remaining = firstProp(_part);
      _partName = Object.keys(_part)[0];
      _buffer = new Buffer(_remaining);
      _pos = 0;
    } 
  }

  self.read = function(buffer) {
    if (_partNum === Infinity) nextPart();
    var bytesCopied = Math.min(buffer.length, _remaining);

    buffer.copy(_buffer, _pos, bytesCopied);
    _pos += bytesCopied;
    _remaining -= bytesCopied;
    
    if (_remaining > 0) { 
      return;
    } else {
      _fullBuffer = Buffer.concat(_fullBuffer, _buffer);
      if (_partNum === _parts.length - 1) {
        var extracted = self.extract(_fullBuffer);
        self.onData(extracted.meta, extracted.buffer);
      } else {
        switch _partName {
          case 'totalLength':
            _parts.data = _buffer.readUInt32LE();
            break;
          case 'jsonLength':
            _parts.json = _buffer.readUInt16LE() - 6;
            _parts.data -= _parts.json;
            break;
        }

        nextPart();
      }
    }
  }

  self.extract = function (buffer) {
    var totalLength = buffer.readUInt32LE(0);
    var jsonLength = buffer.readUInt16LE(4);
    var json = buffer.toString('utf8', 6, jsonLength+6);
    var meta = JSON.parse(json);
    return { meta: meta, buffer: buffer.slice(6+jsonLength) };
  }

  self.stream.on('data', function(data) {
    self.read(data);
  });

  this.addMeta = function(buffer, meta) {
    var json = JSON.stringify(meta);
    var jsonBuffer = new Buffer(json);
    var totalLength = jsonBuffer.length + 4 + 2 + buffer.length;
    var outBuffer = new Buffer(totalLength);
    outBuffer.writeUint32LE(totalLength);
    outBuffer.writeUInt16LE(jsonBuffer.length, 0);
    outBuffer.write(json, 4);
    buffer.copy(outBuffer, 4 + 2 + jsonBuffer.length);
    return outBuffer;
  }

  this.write = function(meta, buffer) {
    var newBuffer = self.addMeta(buffer, meta);
    stream.write(newBuffer);
  }

  return self;
}


