// #region ADELPHOS-SESSION 2026-09-20/payment-simulation/01a0b8b9
// Fail closed if an offline fixture accidentally acquires a real transport.
const deny = () => { throw new Error('Network disabled during payment simulation'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const transport = require(name);
  transport.request = deny;
  transport.get = deny;
}
const net = require('node:net');
net.connect = net.createConnection = net.Socket.prototype.connect = deny;
require('node:tls').connect = deny;
require('node:dgram').createSocket = deny;
// #endregion ADELPHOS-SESSION 01a0b8b9
