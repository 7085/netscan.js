/* 	Simulates a server that instantly closes on connect */

const net = require('net');

const server = net.createServer((socket) => {
	socket.on('data', (data) => {
		socket.end();
		socket.destroy();
	});

});

server.on('error', (err) => {
	throw err;
});

server.listen(9002, () => {
	console.log('serverCloseOnConnect listening on 9002');
});
