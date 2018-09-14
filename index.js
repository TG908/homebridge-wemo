var Service, Characteristic;
var net = require('net');

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-vsx", "VSX", VSX);
};

function VSX(log, config) {
  this.log = log;
  this.name = config.name;
  this.HOST = config.ip;
  this.PORT = config.port;
  this.INPUT = config.input;
}

VSX.prototype.getServices = function () {
  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(
      Characteristic.Manufacturer, "Pioneer");

  this.switchService = new Service.Switch(this.name);
  this.switchService.getCharacteristic(Characteristic.On)
  .on('set', this.setOn.bind(this))
  .on('get', this.getOn.bind(this));

  this.speakerService = new Service.Speaker(this.name);
  this.speakerService
  .addCharacteristic(new Characteristic.Volume())
  .on('set', this.setVolume.bind(this))
  .on('get', this.getVolume.bind(this));

  this.speakerService
  .getCharacteristic(Characteristic.Mute)
  .on('set', this.setMuted.bind(this))
  .on('get', this.getMuted.bind(this));

  return [this.switchService, this.speakerService, this.informationService];
};

VSX.prototype.getOn = function (callback) {

  sleep(100);
  const me = this;
  me.log('Query Power Status on ' + me.HOST + ':' + me.PORT + " input " + me.INPUT);

  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex)
  });

  client.connect(me.PORT, me.HOST, function () {
    client.write('?P\r\n');
  });

  client.on('data', function (data) {
    me.log('Received data: ' + data);

    var str = data.toString();

    if (str.includes("PWR1")) {
      me.log("Power is Off");
      client.destroy();
      callback(null, false);
    } else if (str.includes("PWR0")) {
      me.log("Power is On");
      if (me.INPUT != null) {
        client.write('?F\r\n'); // Request input
      } else {
        client.destroy();
        callback(null, true);
      }
    } else if (str.includes("FN")) {
      me.log("Current input is " + str);
      client.destroy();
      if (str.includes(me.INPUT)) {
        me.log("Current input matches target input of " + me.INPUT);
        callback(null, true);
      } else {
        me.log("Receiver has different input selected");
        callback(null, false);
      }
    } else {
      me.log("waiting");
    }
  });
};

VSX.prototype.setOn = function (on, callback) {

  sleep(100);
  const me = this;
  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex)
  });

  if (on) {
    client.connect(me.PORT, me.HOST, function () {
      me.log('Set Power On on '
          + me.HOST + ':' + me.PORT + " input " + me.INPUT);
      client.write('PO\r\n');
      if (me.INPUT == null) {
        client.destroy();
      }
    });
    client.on('data', function (data) {
      me.log("Change input to " + me.INPUT);
      client.write(me.INPUT + 'FN\r\n');
      client.destroy();
    });
  }

  if (!on) {
    client.connect(me.PORT, me.HOST, function () {
      me.log('Set Power Off on ' + me.HOST + ':' + me.PORT);
      client.write('PF\r\n');
      client.destroy();
    });
  }
  callback();
};

VSX.prototype.getVolume = function (callback) {

  sleep(100);
  const me = this;
  me.log('Query Volume Status on '
      + me.HOST + ':' + me.PORT);

  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex);
  });

  me.log("Connecting");
  client.connect(me.PORT, me.HOST, function () {
    client.write('?V\r\n');
  });

  client.on('data', function (data) {
    me.log('Received data: ' + data);

    var str = data.toString();

    if (str.includes("VOL")) {
      var volume = str.substring(3).replace(/\r|\n/g, "");
      var volume_pct_f = Math.floor(parseInt(volume) * 100 / 185);
      var volume_pct = Math.floor(volume_pct_f);
      me.log("Volume is " + volume + " -- Volume pct is " + volume_pct);
      client.destroy();
      callback(null, volume_pct);
    } else {
      me.log("waiting");
    }
  });
};


VSX.prototype.setVolume = function (volume, callback) {

  sleep(100);
  const me = this;
  me.log('Set Volume Status on '
      + me.HOST + ':' + me.PORT);

  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex);
  });

  me.log("Volume target : " + volume + "%");
  var vol_vsx = volume * 185 / 100;
  vol_vsx = Math.floor(vol_vsx);
  var pad = "000"
  var vol_vsx_str = pad.substring(0, pad.length - vol_vsx.toString().length) + vol_vsx.toString();
  var command = vol_vsx_str + 'VL\r\n'
  me.log("Volume target : " + vol_vsx_str);
  me.log("Command : " + command)
  me.log("Connecting");

  client.connect(me.PORT, me.HOST, function () {
    client.write(command);
    client.destroy();
  });
  callback();

};

VSX.prototype.getMuted = function (callback) {

  sleep(100);
  const me = this;
  me.log('Query Mute Status on ' + me.HOST + ':' + me.PORT);

  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex);
  });

  me.log("Connecting");
  client.connect(me.PORT, me.HOST, function () {
    client.write('?M\r\n');
  });

  client.on('data', function (data) {
    me.log('Received data: ' + data);

    var str = data.toString();

    if (str.includes("MUT0")) {
      me.log("Mute is On");
      client.destroy();
      callback(null, true);
    } else if (str.includes("MUT1")) {
      me.log("Mute is Off");
      client.destroy();
      callback(null, false);
    } else {
      me.log("waiting");
    }
  });
};

VSX.prototype.setMuted = function (mute, callback) {

  sleep(100);

  const me = this;
  var client = new net.Socket();
  client.on('error', function (ex) {
    me.log("Received an error while communicating" + ex);
    callback(ex)
  });

  if (mute) {
    client.connect(me.PORT, me.HOST, function () {
      me.log('Set Mute on ' + me.HOST + ':' + me.PORT);
      client.write('MO\r\n');
      client.destroy();
    });
  }

  if (!mute) {
    client.connect(me.PORT, me.HOST, function () {
      me.log('Set Mute off ' + me.HOST + ':' + me.PORT);
      client.write('MF\r\n');
      client.destroy();
    });
  }
  callback();

};
