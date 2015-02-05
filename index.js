
module.exports = function(stream) {
  var self = this;
  self.stream = stream;

  self.on = function(cb) {
    self.onData = cb;
  }

  var state = 'readTotal'; 
  var totalBytes = -1;
  var pos = 0;

  self.newData = function(buffer) {
    var extracted = self.extract(buffer);
    self.onData(extracted.meta, extracted.buffer);
  }

  function outstart() {
    str = '';
    for (var i=0; i<20 && i<fullBuffer.length; i++) {

      str += '['+fullBuffer.readUInt8(i).toString()+']';
    }
    console.log(str);
  }

  self.read = function(buffer) {
    switch (state) {
      case 'readTotal':
        if (buffer.length - pos >= 4) {
          totalBytes = buffer.readUInt32LE(pos);
          pos += 4;
          bytesLeft = totalBytes-4;
          fullBuffer = new Buffer(4);
          fullBuffer.writeUInt32LE(totalBytes,0);
          state = 'readData';
          self.read(buffer);
        } else {
          totalBuffer = new Buffer(buffer.length-pos);
          buffer.copy(totalBuffer, 0, pos, 4);
          state = 'continueTotal';
          pos = 0;
          totalPos = buffer.length-pos;
        }
        break;
      case 'continueTotal':
        totalBuffer = Buffer.concat([totalBuffer, buffer.slice(0, totalPos)]);
        totalBytes = totalBuffer.readUInt32LE(0);
        pos += totalPos;
        bytesLeft = totalBytes - 4;
        fullBuffer = new Buffer(4);
        fullBuffer.writeUInt32LE(totalBytes);
        state = 'readData';
        self.read(buffer);
        break;
      case 'readData':
        if (bytesLeft <= buffer.length) {
          // - the rest of data is fully contained in buffer
          try {
            var piece = new Buffer(bytesLeft);
            buffer.copy(piece, 0, pos, pos+bytesLeft);
            fullBuffer = Buffer.concat([fullBuffer, piece]);
            pos += bytesLeft;
            bytesLeft = 0;
            self.newData(fullBuffer);
            
          } catch (ee) {
            console.log('newData prob?');
            console.log(ee);
          }
          state = 'readTotal';
          if (pos < buffer.length) {
            // and another thing starts after
            
            return self.read(buffer);
          } else {
            pos = 0;
          }
        } else {
          // - the data continues after end of buffer
          var piece = new Buffer(buffer.length - pos);
          buffer.copy(piece, 0, pos, buffer.length);
          fullBuffer = Buffer.concat([fullBuffer, piece]);
          pos = 0;
          bytesLeft -= piece.length;
        } 
        break;
    }
  }

  self.extract = function(buffer) {
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


