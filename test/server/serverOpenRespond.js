/* 	Simulates a server with a protocol mismatch,
	which waits for further data. */

const net = require('net');

const server = net.createServer((socket) => {
	console.log('client connected');

	socket.on('end', () => {
		console.log('client disconnected');
	});

	socket.on('data', (data) => {
		socket.write('command not understood..\r\n');
	});

	setTimeout(() => {
		socket.end();
		socket.destroy();
	}, 40000);
});

server.on('error', (err) => {
	throw err;
});

server.listen(9000, () => {
	console.log('server bound');
});
