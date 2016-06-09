/** 
 * Simulates a server with a protocol mismatch, that means
 * it answers with an error message and keeps the connection 
 * open (for a certain amount of time), responding with error 
 * messages whenever some data arrives.
 **/

const net = require('net');
const path = require('path');

const name = path.basename(__filename, '.js');
const port = 9000;

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

	server.listen(port, () => {
		L('listening on '+ port);
	});
}

module.exports = start;

/* running standalone */
if(require.main === module){
	start();
}