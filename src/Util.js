/**
 * Util contains all utility functions for parsing and converting data structures.
 */
export default class Util {
	/**
	 * Parses a WebRTC SDP and gathers all public and private ip and port 
	 * combinations that can be found. 
	 * @param {String} candidate The candidate SDP string.
	 * @return {Object} Containing the entries type (the entry type),
	 * ip (private ip address), port (private port), public_ip (public ip), 
	 * public_port (public port), or null if nothing can be found, which is 
	 * only the case if no valid candidate line is in the string.
	 */
	static extractConnectionInfo(candidate) {
		/**
		 * SDP candidate line structure (a=candidate:)
		 * 1 1 UDP 1686110207  80.110.26.244 50774 typ srflx raddr 192.168.2.108 rport 50774
		 * 2 1 UDP 25108223 	237.30.30.30 58779 typ relay raddr   47.61.61.61 rport 54761
		 * 0 			1 					UDP 				2122252543 		192.168.2.108 		52229 		typ host
		 * candidate | rtp (1)/rtcp (2) | protocol (udp/tcp) | priority 	| ip				| port		| type (host/srflx/relay)
		 */
		var host = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate);
		if (host !== null && host.length === 3) {
			return { type: "host", ip: host[1], port: host[2], public_ip: null, public_port: null };
		}

		var srflx = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ srflx raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);
		if (srflx !== null && srflx.length === 5) {
			return { type: "srflx", ip: srflx[3], port: srflx[4], public_ip: srflx[1], public_port: srflx[2] };
		}

		var relay = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ relay raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);
		if (relay !== null && relay.length === 5) {
			return { type: "relay", ip: relay[3], port: relay[4], public_ip: relay[1], public_port: relay[2] };
		}

		return null;
	}

	/**
	 * Replaces ip and port in a WebRTC SDP candidate line string with 
	 * the data provided in replacement.
	 * @param {String} candidate A string containing a SDP candidate line.
	 * @param {Object} replacement An object with ip and port properties which 
	 * will replace the original ip and port.
	 * @return The replaced string.
	 */
	static replaceConnectionInfo(candidate, replacement) {
		var m = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate)
			|| /((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);

		if (m !== null) {
			var t = candidate.replace(m[1], replacement.ip);
			t = t.replace(m[2], replacement.port);
			return t;
		}

		return candidate;
	}

	/**
	 * Converts a string containing an ip4 address to an array of Numbers.
	 * @param {String} ip An ip4 address.
	 * @return {Array} containing the 4 octets as decimal numbers.
	 */
	static ipToArray(ip) {
		return ip.split(".").map(Number);
	}

	/**
	 * Converts a range of ip addresses to an array which contains 
	 * all single addresses. (Expands the range.)
	 * @param {String} iprange A range of ip adresses, like "192.168.0.1-255"
	 * @return {Array} of ip strings.
	 */
	static ipRangeToArray(iprange) {
		var ranges = [];
		iprange.split(".").map(function (elem) {
			if (elem.indexOf("-") !== -1) {
				ranges.push(elem.split("-").map(Number));
			}
			else {
				var n = Number(elem);
				ranges.push([n, n]);
			}
		});

		var ips = [];
		for (var i = ranges[0][0]; i <= ranges[0][1]; i++) {
			for (var j = ranges[1][0]; j <= ranges[1][1]; j++) {
				for (var k = ranges[2][0]; k <= ranges[2][1]; k++) {
					for (var l = ranges[3][0]; l <= ranges[3][1]; l++) {
						ips.push([i, j, k, l].join("."));
					}
				}
			}
		}

		return ips;
	}

	/**
	 * Converts a range of ports in string representation 
	 * to an array.
	 * @param {String} portrange A portrange (two valid ports separated by -).
	 * @return {Array} of ports (as Numbers).
	 */
	static portRangeToArray(portrange) {
		if (portrange.indexOf("-") !== -1) {
			var range = portrange.split("-").map(Number);

			var ports = [];
			for (var i = range[0]; i <= range[1]; i++) {
				ports.push(i);
			}

			return ports;
		}
		else {
			return [Number(portrange)];
		}
	}

	/**
	 * Parses a string of ports and/or port ranges and 
	 * creates an array containing all ports for easy 
	 * iteration.
	 * Example: "80,90,100-103" becomes [80,90,100,101,102,103]
	 * @param {String} portstring The string containing ports.
	 * @return {Array} of ports.
	 */
	static portStringToArray(portstring) {
		if (portstring.indexOf(",") !== -1) {
			var ports = [];
			portstring.split(",").map((val) => {
				ports = ports.concat(Util.portRangeToArray(val));
			});
			return ports;
		}
		else {
			return Util.portRangeToArray(portstring);
		}
	}

	/**
	 * Determines if a specific ip is a local address.
	 * @param {String | Array} ip The ip address.
	 * @return {boolean} True if the ip is local.
	 */
	static isPrivateIp(ip) {
		if (typeof ip === "string") {
			ip = Util.ipToArray(ip);
		}

		if (ip[0] === 10
			|| (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)
			|| (ip[0] === 192 && ip[1] === 168)) {
			return true;
		}
	}

}