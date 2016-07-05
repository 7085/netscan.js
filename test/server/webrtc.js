const dgram = require('dgram');


const server = dgram.createSocket('udp4');

server.on("error", (err) => {
  console.log("error:", err);
  server.close();
});

server.on("message", (msg, rinfo) => {
  console.log("Received %d bytes from %s:%d : %s", msg.length, rinfo.address, rinfo.port, msg.toString('utf-8'));
});

server.on("listening", () => {
  var address = server.address();
  console.log("server listening on %s:%d", address.address, address.port);
});

server.bind(9999);