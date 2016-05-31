/* 	Simulates a server that instantly closes with some
	message. */

const net = require('net');

const server = net.createServer((socket) => {
	console.log('client connected');

	socket.on('data', (data) => {
		socket.end('error\r\n');
		socket.destroy();
	});

});

server.on('error', (err) => {
	throw err;
});

server.listen(9005, () => {
	console.log('server bound');
});
