
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
    console.log('nextPart _part = ' + JSON.stringify(_part));
    _remaining = firstProp(_part);
    _partName = Object.keys(_part)[0];
    console.log('^^^^^^ ' + _remaining);
    _buffer = new Buffer(_remaining);
  }

  self.read = function(buffer) {
    console.log('top of read');
    if (_partNum === Infinity) nextPart();
    console.log("_buffer.length is " + _buffer.length);
    var bytesCopied = Math.min(buffer.length, _remaining);

    console.log('copying ' + bytesCopied + ' bytes');    
    buffer.copy(_buffer, _partPos, _pos, _pos+bytesCopied);
    _pos += bytesCopied;
    _partPos += bytesCopied;
    _remaining -= bytesCopied;
    console.log('_buffer is now ' + outBuff(_buffer));
    if (_remaining > 0) { 
      console.log('more remaining in part');
      nextPart();
      return self.read(buffer);
    } else {
      console.log('done with part');
      _fullBuffer = Buffer.concat([_fullBuffer, _buffer]);
      if (_partNum === _parts.length - 1) {
        console.log('done with all');
        console.log('**'+_buffer.toString()+'**');
        var extracted = self.extract(_fullBuffer);
        _partNum = Infinity;
        _pos = 0;
        _partPos = 0;
        self.onData(extracted.meta, extracted.buffer);
      } else {
        console.log('handling part info');
        switch (_partName) {
          case 'totalLength':
            _parts[3].data = _buffer.readUInt32LE(0);
            console.log('read data length ' + _parts.data);
            break;
          case 'jsonLength':
            _parts[2].json = _buffer.readUInt16LE(0);
            console.log('read json length ' + _parts[2].json);
            _parts[3].data -= _parts[2].json + 6;
            break;
        }
        console.log('going to next');
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
    console.log('data event on stream');
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
    var newBuffer = self.addMeta(buffer, meta);
    self.stream.write(newBuffer);
    console.log('wrote ' + newBuffer.length);
    console.log('buffer wrote was ' + outBuff(newBuffer));
  }

  return self;
}


