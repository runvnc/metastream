
module.exports = function(stream) {
  var self = this;
  self.stream = stream;

  self.on = function(cb) {
    self.onData = cb;
  }

  function firstProp(obj) {
    return obj[Object.keys(obj)[0]];
  }

  function outBuff(buff) {
    str = '';
    for (var i=0; i< buff.length; i++ ){
      str += '['+buff.readUInt8(i)+'] ';
    }
    return str;
  }

  var _parts =
    [ { 'totalLength': 4 },
      { 'jsonLength': 2 },
      { 'json': Infinity },
      { 'data': Infinity } ];

  var _partName = null,
      _pos = 0,
      _partPos = 0,
      _fullBuffer = new Buffer(''),
      _partNum = Infinity,
      _remaining = Infinity,
      _buffer = null;

  function nextPart() {
    if (_partNum === Infinity) {
      _partNum = 0;
    } else {
      _partNum += 1;
    }
    _partPos = 0;
    _part = _parts[_partNum];
    _remaining = firstProp(_part);
    _partName = Object.keys(_part)[0];
    _buffer = new Buffer(_remaining);
  }

  self.read = function(buffer) {
    if (_partNum === Infinity) nextPart();
    var bytesCopied = Math.min(buffer.length-_pos, _remaining);
    
    if (buffer.length-_pos > bytesCopied) {
      var leftAtEnd = buffer.length-(_pos+bytesCopied);
    } else {
      var leftAtEnd = 0;
    }
    buffer.copy(_buffer, _partPos, _pos, _pos+bytesCopied);
    _pos += bytesCopied;
    _partPos += bytesCopied;
    _remaining -= bytesCopied;
    if (_remaining > 0) {
      nextPart();
      return self.read(buffer);
    } else {
      _fullBuffer = Buffer.concat([_fullBuffer, _buffer]);
      if (_partNum === _parts.length - 1) {
        var extracted = self.extract(_fullBuffer);
        _partNum = Infinity;
        _pos = 0;
        _partPos = 0;
        self.onData(extracted.meta, extracted.buffer);
        _fullBuffer = new Buffer('');
        if (leftAtEnd > 0) {
          _pos = buffer.length-leftAtEnd;
          self.read(buffer);
        }
      } else {
        switch (_partName) {
          case 'totalLength':
            _parts[3].data = _buffer.readUInt32LE(0);
            break;
          case 'jsonLength':
            _parts[2].json = _buffer.readUInt16LE(0);
            _parts[3].data -= _parts[2].json + 6;
            break;
        }
        nextPart();
        return self.read(buffer);
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
    outBuffer.writeUInt32LE(totalLength,0);
    outBuffer.writeUInt16LE(jsonBuffer.length, 4);
    outBuffer.write(json, 6);
    buffer.copy(outBuffer, 4 + 2 + jsonBuffer.length);
    return outBuffer;
  }

  this.write = function(meta, buffer) {
    if (buffer === null || buffer === undefined) {
      buffer = new Buffer(' ');
    }
    var newBuffer = self.addMeta(buffer, meta);
    self.stream.write(newBuffer);
  }

  return self;
}


