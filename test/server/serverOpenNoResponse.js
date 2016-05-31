/* 	Simulates a server which waits for further data,
	but does not respond, closes after a certain time */

const net = require('net');

const server = net.createServer((socket) => {
	console.log('client connected');

	socket.on('end', () => {
		console.log('client disconnected');
	});

	socket.on('data', (data) => {
		console.log('data recv');
	});

	setTimeout(() => {
		socket.end();
		socket.destroy();
	}, 40000);
});

server.on('error', (err) => {
	throw err;
});

server.listen(9004, () => {
	console.log('server bound');
});
