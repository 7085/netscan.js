/** 
 * Simulates a server that instantly closes on connect,
 * before receiving data.
 **/

const net = require('net');
const path = require('path');

const name = path.basename(__filename, '.js');
const port = 9005;

function L(msg){
	console.log(name, msg);
}

function start(_port = -1){
	if(_port !== -1){
		port = _port;
	}
	
	const server = net.createServer((socket) => {
		L('client connected');
		
		// socket.on('end', () => {
		// 	L('client disconnected');
		// });

		socket.end();
		socket.destroy()
	});

	server.on('error', (err) => {
		throw err;
	});

	server.listen(port, () => {
		L('listening on ' + port);
	});
}

module.exports = start;

/* running standalone */
if(require.main === module){
	start();
}