var Service, Characteristic;
var net = require('net');

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
  this.TS = null; 
  this.CLIENT = null;
  this.ON = null;
}

VSX.prototype.getServices = function () {
  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(
      Characteristic.Manufacturer, "Pioneer");

  this.switchService = new Service.Switch(this.name);
  this.switchService.getCharacteristic(Characteristic.On)
  .on('set', this.setOn.bind(this))
  .on('get', this.getOn.bind(this));

  return [this.switchService, this.informationService];
};

function getRetryConnection(me) {
  me.CLIENT.connect(me.PORT, me.HOST, function () {
      me.CLIENT.write('?P\r\n');
  });
}

VSX.prototype.getOn = function (callback) {

  const me = this;
  me.log('Query Power Status on '
      + me.HOST + ':' + me.PORT + " input " + me.INPUT);

  if (me.INPUT != null) {
      callback(null, false);
      return;
  }

  me.CLIENT = new net.Socket();
  me.TS = Date.now();

  me.CLIENT.on('error', function (ex) {
    if ( (Date.now() - me.TS) >= 1000) {
        me.log("Received an error while communicating " + ex);
        callback(ex);
    } else {
	setTimeout(getRetryConnection, 100, me);
    }
  });

  getRetryConnection(me);

  me.CLIENT.on('data', function (data) {
    me.log('Received data: ' + data);

    var str = data.toString();

    if (str.includes("PWR1")) {
      me.log("Power is Off");
      me.CLIENT.destroy();
      callback(null, false);
    } else if (str.includes("PWR0")) {
      me.log("Power is On");
      if (me.INPUT != null) {
        me.CLIENT.write('?F\r\n'); // Request input
      } else {
        me.CLIENT.destroy();
        callback(null, true);
      }
    } else if (str.includes("FN")) {
      me.log("Current input is " + str);
      me.CLIENT.destroy();
      if (str.includes(me.INPUT)) {
        me.log("Current input matches target input of " + me.INPUT);
        callback(null, false /* true */);
      } else {
        me.log("Receiver has different input selected");
        callback(null, false);
      }
    } else {
      me.log("waiting");
    }
  });
};

function setRetryConnection(me) {

  if (me.ON) {
    me.CLIENT.connect(me.PORT, me.HOST, function () {
      me.log('Set Power On on '
          + me.HOST + ':' + me.PORT + " input " + me.INPUT);
      me.CLIENT.write('PO\r\n');
      if (me.INPUT == null) {
        me.CLIENT.destroy();
      }
    });
    me.CLIENT.on('data', function (data) {
      me.log("Change input to " + me.INPUT);
      me.CLIENT.write(me.INPUT + '\r\n');
      me.CLIENT.destroy();
      setTimeout(
	 () => me.switchService.getCharacteristic(Characteristic.On).updateValue(false),
	 100,
      );
    });
  } else {
    if (me.INPUT == null) {
        me.CLIENT.connect(me.PORT, me.HOST, function () {
        me.log('Set Power Off on ' + me.HOST + ':' + me.PORT);
        me.CLIENT.write('PF\r\n');
        me.CLIENT.destroy();
      });
    } else {
      me.CLIENT = null;
    }
  }
}

VSX.prototype.setOn = function (on, callback) {

  const me = this;
  
  me.CLIENT = new net.Socket();
  me.TS = Date.now();
  me.ON = on;

  me.CLIENT.on('error', function (ex) {
    if ( (Date.now() - me.TS) >= 1000) {
        me.log("Received an error while communicating" + ex);
        try {
	    callback(ex);
	} catch (error) {
	}
    } else {
	setTimeout(setRetryConnection, 100, me);
    }
  });

  setRetryConnection(me);

  callback();
};

