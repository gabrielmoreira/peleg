'use strict';

var Promise = require('bluebird');
var amqplib = require('amqplib');
var compat = require('./compat.js');

amqplib.connect = compat.fromWhenFn(amqplib.connect);

exports = module.exports = amqplib;
