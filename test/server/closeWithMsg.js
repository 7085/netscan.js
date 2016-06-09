/**
 * Simulates a server that closes after receiving some 
 * data with some message. 
 **/

const net = require('net');
const path = require('path');

const name = path.basename(__filename, '.js');
const port = 9003;

function L(msg){
	console.log(name, msg);
}


function start(_port = -1){
	if(_port !== -1){
		port = _port;
	}
		
	const server = net.createServer((socket) => {
		L('client connected');
		
		socket.on('end', () => {
			L('client disconnected');
		});

		socket.on('data', (data) => {
			L('data recv, closing connection with msg...');
			socket.end('error\r\n');
			socket.destroy();
		});

	});

	server.on('error', (err) => {
		throw err;
	});

	server.listen(port, () => {
		L('listening on '+ port);
	});
}

module.exports = start;

/* running standalone */
if(require.main === module){
	start();
}
