/******************************************************************************
 *                               - NetScan.js -                                
 * A JavaScript library for client side host discovery and port scanning.
 * 
 * Author: Tobias Fink (e1026737@student.tuwien.ac.at)
 *****************************************************************************/

import Timer from "Timer";
import Util from "Util";
import ScanResult from "ScanResult";


// @ts-ignore
const RTCPeerConnection = window.RTCPeerConnection
	// @ts-ignore
	|| window.mozRTCPeerConnection
	// @ts-ignore
	|| window.webkitRTCPeerConnection
	// @ts-ignore
	|| window.msRTCPeerConnection;


/**
 * Feature detect, issues warning when something is not supported by the browser.
 */
if (!window.fetch) {
	console.warn("This browser does not support the fetch API - lowered result accuracy!");
}
if (!window.performance) {
	console.warn("This browser does not support the performance API - lowered result accuracy!");
}
if (!RTCPeerConnection) {
	console.warn("This browser does not support the WebRTC API - cannot detect local IP!");
}
if (!WebSocket) {
	console.warn("This browser does not support the WebSocket API - WebSocket scanning not possible!");
}



/**
 * Internal variables.
 */
const socketPool = [];
const poolCap = 130;
/* This value should be kept very low (<= 10), otherwise many wrong results will be produced */
const maxConcurrentHTMLRequests = 5;

/**
 * Timing default settings.
 */
const timingLowerBound = 2900;
const timingUpperBound = 10000;
const xhrTimeout = 20000;
const wsoTimeout = 20000;
const fetchTimeout = 20000;
const htmlTimeout = 20000;
const portScanTimeout = 5000;

/**
 * Result messages used internally.
 */
const resultMsgTimeout = "NETWORK TIMEOUT";
const resultMsgError = "NETWORK ERROR";
const resultMsgData = "DATA RECEIVED";
const resultMsgConnected = "CONNECTION OPENED";
const resultMsgDisconnected = "CONNECTION CLOSED";
const resultMsgPerfTiming = "PERF-TIMING CONNECTION RECORD";

export default class NetScan {
	/**
	 * Retrieves all private and public ip addresses
	 * and ports assigned to the current host.
	 * @param {Function} cbReturn Gets a list of ip and port combinations 
	 * which were found in the gathering process.
	 */
	static getHostIps(cbReturn) {
		Timer.start("getHostIps");
		const ips = [];

		const serverConfig = {
			iceServers: [
				{ urls: ["stun:stun.l.google.com:19302"] }
			]
		};

		var conn = new RTCPeerConnection(serverConfig, null);
		var sendChan = conn.createDataChannel("netscan", null);

		conn.onicecandidate = function (evt) {
			if (evt.candidate !== null) {
				const candidate = evt.candidate;
				//console.log("Got candidate:", candidate.candidate);

				const host = Util.extractConnectionInfo(candidate.candidate);
				if (host !== null) {
					ips.push(host);
				}
			}
			/** 
			 * At this state (evt.candidate == null) we are finished, see:
			 * https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection/onicecandidate 
			 */
			else {
				Timer.stop("getHostIps");
				sendChan.close();
				conn.close();
				sendChan = null;
				conn = null;
				//console.log("getting ip took:", Timer.duration("getHostIps"));
				cbReturn(ips);
			}
		};

		try {
			conn.createOffer()
				.then(function (offerDesc) {
					conn.setLocalDescription(offerDesc);
				},
				// eslint-disable-next-line no-unused-vars
				function (error) {/* dont care */ });
		}
		catch (/* TypeError */ error) {

			/**
			 * Fallback for older version of createOffer which requires 
			 * two callbacks instead of the newer Promise which will be returned 
			 */
			conn.createOffer(
				function (offerDesc) {
					conn.setLocalDescription(offerDesc);
				},
				// eslint-disable-next-line no-unused-vars
				function (error) {/* dont care */ });
		}
	}


	/**
	 * Creates a single connection by using a XMLHttpRequest.
	 * @param {String} address The address to scan.
	 * @param {Function} handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param {Number} connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 */
	static createConnectionXHR(address, handleSingleResult, connectionTimeout = xhrTimeout) {
		var startTime = 0;

		const x = new XMLHttpRequest();
		x.timeout = connectionTimeout;

		x.onerror = () => {
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgError);
		};

		x.ontimeout = () => {
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgTimeout);
		};

		x.onload = () => {
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgData);
		};

		startTime = Timer.getTimestamp();

		x.open("HEAD", address, true);
		x.send();
	}


	/**
	 * Performs a scan with XMLHttpRequests on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param {String} iprange A range of ips.
	 * @param {Function} scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 */
	static getHostsXHR(iprange, scanFinishedCB) {
		const results = [];
		const protocol = "http://";
		const addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info) {
			const status = timing < timingLowerBound || timing > timingUpperBound ? "up" : "down";
			results.push(new ScanResult(
				address,
				timing,
				status,
				info
			));

			/* last result received, return */
			if (results.length === addresses.length) {
				/* check if we can add some additional info of perf timing API */
				NetScan._updateResultsWithPerfTimingData(results, "up");

				scanFinishedCB(results);
			}
		}

		/* clear all perftiming entries for reliable results */
		NetScan._clearPerfTimingData();

		for (let i = 0; i < addresses.length; i++) {
			NetScan.createConnectionXHR(protocol + addresses[i], handleSingleResult);
		}
	}


	/**
	 * Creates a single connection by using a WebSocket.
	 * @param {String} address The address to scan.
	 * @param {Function} handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param {Number} connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 */
	static createConnectionWS(address, handleSingleResult, connectionTimeout = wsoTimeout) {
		const startTime = Timer.getTimestamp();
		var wsResult = false;
		var timeout;
		var ws;

		function onresult(address, timing, info) {
			if (!wsResult) {
				clearTimeout(timeout);
				wsResult = true;

				socketPool.splice(socketPool.indexOf(ws), 1);
				ws.close();
				ws = null;

				handleSingleResult(address, timing, info);
			}
		}

		try {
			ws = new WebSocket(address);

			ws.onopen = function (/* evt */) {
				onresult(address, Timer.getTimestamp() - startTime, resultMsgConnected);
			};

			ws.onclose = function (/*CloseEvent*/ evt) {
				if (evt.code === 4999 && evt.reason === resultMsgTimeout) {
					onresult(address, Timer.getTimestamp() - startTime, resultMsgTimeout);
				}
				else {
					onresult(address, Timer.getTimestamp() - startTime, resultMsgDisconnected);
				}
			};

			ws.onerror = function (/* evt */) {
				onresult(address, Timer.getTimestamp() - startTime, resultMsgError);
			};

			socketPool.push(ws);

			/** 
			 * trigger a manual close after some time, identified by "code" and "reason"
			 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes 
			 */
			timeout = setTimeout(function () {
				ws.close(4999, resultMsgTimeout);
			}, connectionTimeout);

			/**
			 * XXX: There is no reliable way of disabling/avoiding a popup in FF 
			 * when a HTTP authorization is required.
			 * The WebSocket RFC includes the possibility to define custom headers,
			 * but the browser APIs don't :(.
			 * Using a user:pass@hostname.tld scheme would work, but only if the 
			 * user-password combination is correct. Otherwise it will retrigger the 
			 * popup in a loop...
			 * 
			 * So this case will result in a timeout and handled correctly this way.
			 */
		}
		catch (err) {
			handleSingleResult(address, 0, resultMsgError + " (" + err.toString() + ")");
		}
	}


	/**
	 * Performs a scan with WebSockets on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param {String} iprange A range of ips.
	 * @param {Function} scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 */
	static getHostsWS(iprange, scanFinishedCB) {
		/** 
		 * create a connection pool, browsers only support a certain limit of
		 * simultaneous connections for websockets (ff ~200) 
		 */
		const results = [];
		const protocol = "ws://";
		const ips = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info) {
			var status = timing < timingLowerBound || timing > timingUpperBound ? "up" : "down";

			if (info === resultMsgConnected) {
				status = "up";
			}

			results.push(new ScanResult(
				address,
				timing,
				status,
				info
			));
		}

		/* clear all perftiming entries for reliable results */
		NetScan._clearPerfTimingData();

		/* initially fill pool */
		for (let i = 0; i < poolCap && ips.length > 0; i++) {
			NetScan.createConnectionWS(protocol + ips.shift(), handleSingleResult);
		}

		/* then regularly check if there is space for new conns */
		var poolMonitor = setInterval(function () {
			if (ips.length < 1 && socketPool.length === 0) {
				/* finished */
				clearInterval(poolMonitor);

				/* check if we can add some additional info of perf timing API */
				NetScan._updateResultsWithPerfTimingData(results, "up");

				scanFinishedCB(results);
			}

			while (socketPool.length < poolCap && ips.length > 0) {
				NetScan.createConnectionWS(protocol + ips.shift(), handleSingleResult);
			}

		}, 50);

	}


	/**
	 * Creates a single connection by using the fetch API.
	 * @param {String} address The address to scan.
	 * @param {Function} handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param {Number} connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 */
	static createConnectionFetch(address, handleSingleResult, connectionTimeout = fetchTimeout) {
		const config = new Request(address, {
			method: "GET",
			/**	
			 * This will make an "opaque" request, such that CORS requests 
			 * will succeed even if there is no "CORS header". The response gets
			 * "nulled", but we will know when HTTP is understood by the remote host.
			 */
			mode: "no-cors",
			/* Always make a "new / real" request, don't use possibly cached versions. */
			cache: "no-store"
		});
		const startTime = Timer.getTimestamp();

		const timeout = new Promise((resolve, reject) => {
			setTimeout(() => reject(new Error(resultMsgTimeout)), connectionTimeout);
		});

		const requ = fetch(config);

		const p = Promise.race([timeout, requ]);
		p.then((/* resp */) => {
			// console.log(resp.headers);
			// console.log(resp.type, resp.ok, resp.status, resp.statusText);
			// resp.text().then((body) => {
			// 	console.log(body);
			// });
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgData);
		}).catch(/* TypeError */ err => {
			if (err.message === resultMsgTimeout) {
				handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgTimeout);
			}
			else {
				handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgError);
			}
		});
	}


	/**
	 * Performs a scan with fetch API requests on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param {String} iprange A range of ips.
	 * @param {Function} scanFinishedCB The callback which gets the results.
	 *        {Array} results Containing result objects for each address.
	 */
	static getHostsFetch(iprange, scanFinishedCB) {
		const results = [];
		const protocol = "http://";
		const addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info) {
			var status = timing < timingLowerBound || timing > timingUpperBound ? "up" : "down";

			if (info === resultMsgData) {
				status = "up";
			}

			results.push(new ScanResult(
				address,
				timing,
				status,
				info
			));

			/* last result received, return */
			if (results.length === addresses.length) {
				/* check if we can add some additional info of perf timing API */
				NetScan._updateResultsWithPerfTimingData(results, "up");

				scanFinishedCB(results);
			}
		}

		/* clear all perftiming entries for reliable results */
		NetScan._clearPerfTimingData();

		for (let i = 0; i < addresses.length; i++) {
			NetScan.createConnectionFetch(protocol + addresses[i], handleSingleResult);
		}
	}


	/**
	 * Creates a single connection by using a HTML element.
	 * @param {String} address The address to scan.
	 * @param {Function} handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param {Number} connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 */
	static createConnectionHTML(address, handleSingleResult, connectionTimeout = htmlTimeout) {
		const request = new Image();
		var timeout;
		var startTime;

		request.onerror = function (/* evt */) {
			clearTimeout(timeout);
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgError);
		};

		request.onload = function (/* evt */) {
			clearTimeout(timeout);
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgData);
		};

		timeout = setTimeout(function () {
			handleSingleResult(address, Timer.getTimestamp() - startTime, resultMsgTimeout);
			/* this will cancel the request */
			request.onload = request.onerror = function () { };
			request.src = "";
		}, connectionTimeout);

		startTime = Timer.getTimestamp();
		/* start the request */
		request.src = address;
	}


	/**
	 * Performs a scan by creating requests through html elements on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param {String} iprange A range of ips.
	 * @param {Function} scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 */
	static getHostsHTML(iprange, scanFinishedCB) {
		const results = [];
		const protocol = "http://";
		const addresses = Util.ipRangeToArray(iprange);
		/* Needed because we can only make a very small amount of simultaneous requests... */
		var concurrentRequests = 0;
		var requestsMade = 0;

		function handleSingleResult(address, timing, info) {
			concurrentRequests--;
			var status = timing < timingLowerBound || timing > timingUpperBound ? "up" : "down";

			if (info === resultMsgData) {
				status = "up";
			}

			results.push(new ScanResult(
				address,
				timing,
				status,
				info
			));

			/* last result received, return */
			if (results.length === addresses.length) {
				/* check if we can add some additional info of perf timing API */
				NetScan._updateResultsWithPerfTimingData(results, "up");

				scanFinishedCB(results);
			}
		}

		/* clear all perftiming entries for reliable results */
		NetScan._clearPerfTimingData();

		var requestMonitor = setInterval(function () {
			if (requestsMade >= addresses.length) {
				clearInterval(requestMonitor);
			}
			else {
				if (concurrentRequests < maxConcurrentHTMLRequests
					&& requestsMade < addresses.length) {
					NetScan.createConnectionHTML(protocol + addresses[requestsMade], handleSingleResult);
					concurrentRequests++;
					requestsMade++;
				}
			}
		}, 100);

	}


	/**
	 * Scans all hosts in the current local network.
	 * The local network will be determined automatically.
	 * @param {Function} scanFinishedCB Callback which will receive the results as soon as 
	 * 		the scan is complete.
	 * 		Array results Containing result objects for each address.
	 * @param {Function} scanFunction (optional) One of the available functions
	 * 		for scanning an iprange can be provided. The default is the function using 
	 * 		the fetch API.
	 */
	static getHostsLocalNetwork(scanFinishedCB, scanFunction = NetScan.getHostsFetch) {
		NetScan.getHostIps(function (ips) {
			const toTest = {};
			var testCount = 0;
			var testedCount = 0;
			var all = [];

			function resultAccumulator(res) {
				all = all.concat(res);
				testedCount++;
				if (testedCount === testCount) {
					scanFinishedCB(all);
				}
			}

			for (let i = 0; i < ips.length; i++) {
				if (toTest[ips[i].ip] === undefined) {
					toTest[ips[i].ip] = true;
					testCount++;
				}
			}

			for (let ip in toTest) {
				const tip = Util.ipToArray(ip);
				tip[3] = "0-255";
				const range = tip.join(".");
				scanFunction(range, resultAccumulator);
			}
		});
	}


	/**
	 * Scans the specified ports of a host and tries to 
	 * determine their status (whether they are open or closed).
	 * 
	 * @param {String} host The host to scan.
	 * @param {String} portrange A string containing a range/list of ports.
	 * The string can contain a single port, a comma separated list of ports 
	 * or a range (two ports separated by a '-' character), or a mixture of 
	 * them.
	 * @param {Function} scanFinishedCB Callback which will receive the results as soon as 
	 * the scan is complete. An array containing result objects for each port will be passed
	 * as argument to the callback.
	 * @param {Function} scanFunction One of the 'createConnection*'-functions which will be
	 * used to perform the scan on each individual port. The default is createConnectionFetch.
	 */
	static getPorts(host, portrange, scanFinishedCB, scanFunction = NetScan.createConnectionFetch) {
		var ports = Util.portStringToArray(portrange);
		/** 
		 * Browser port restrictions, can be found in the fetch spec:
		 * https://fetch.spec.whatwg.org/#port-blocking 
		 * those seem to be enforced to all kinds of connections
		 * creating a websocket will instantly fail with an exception, 
		 * a xhr will be blocked when the request is sent and returns very fast
		 * The specific lists can be found at:
		 * - CHROME/CHROMIUM: 
		 * 		https://cs.chromium.org/chromium/src/net/base/port_util.cc?q=kRestrictedPorts&sq=package:chromium&dr=CSs&l=22
		 * - FF: 
		 * 		https://developer.mozilla.org/en-US/docs/Mozilla/Mozilla_Port_Blocking
		 * A few exceptions exist, depending on a specific protocol, e.g. FTP allows 21 and 22,
		 * chrome only supports ftp.
		 * FF has some more protocols, but also only ftp allows further ports (21, 22) see:
		 * 		https://dxr.mozilla.org/mozilla-central/search?q=%2Boverrides%3A%22nsIProtocolHandler%3A%3AAllowPort%28int32_t%2C+const+char+*%2C+bool+*%29%22
		 * Still there is the possibility that the ftp protocol will be removed (at least from chrome/ium),
		 * see: https://bugs.chromium.org/p/chromium/issues/detail?id=333943
		 */
		const blocked = [
			1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37,
			42, 43, 53, 77, 79, 87, 95, 101, 102, 103, 104, 109,
			110, 111, 113, 115, 117, 119, 123, 135, 139, 143, 179,
			389, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540,
			556, 563, 587, 601, 636, 993, 995, 2049, 3659, 4045,
			6000, 6665, 6666, 6667, 6668, 6669
		];

		const results = [];

		/* clear all perftiming entries for reliable results */
		NetScan._clearPerfTimingData();

		for (let i = 0; i < ports.length; i++) {
			let url = "http://" + host + ":" + ports[i];
			if (blocked.indexOf(ports[i]) !== -1) {
				/* exception which can be resolved by ftp */
				if (ports[i] === 21 || ports[i] === 22) {
					url = "ftp://" + host + ":" + ports[i];
					/* note: only html scan can connect to ftp addresses */
					NetScan.createConnectionHTML(url, onResult, portScanTimeout);
				}
				else {
					onResult(url, 0, "BLOCKED");
				}
			}
			else {
				scanFunction(url, onResult, portScanTimeout);
			}
		}

		/**
		 * Observations (when host is up):
		 * -------------------------------
		 * legend:
		 * [+] = can be detected
		 * [-] = cannot be distinguished (when there are mutiple indistinguishable cases)
		 * [?] = needs further investigation / undetectable because of browser bug or unsupported API
		 * 
		 * # Chromium (Version 51.0.2704.79 Built on 8.4, running on Debian 8.5 (64-bit)):
		 * [-] port no connection: 		returns fast (net::ERR_CONNECTION_REFUSED in console)
		 * [?] port closed no resp: 	returns fast (net::ERR_EMPTY_RESPONSE in console),
		 * 								cannot be distinguished currently, maybe when chrome/ium 
		 * 								extends the performance timing api, like it is already handled 
		 * 								in FF, see https://bugs.chromium.org/p/chromium/issues/detail?id=460879#c11
		 * [+] port closed w/ resp: 	returns fast, can be detected with fetch (+no-cors request),
		 * 								also performance timing entry
		 * [+] port opened no resp: 	hangs until timeout
		 * [+] port opened w/ resp: 	hangs until timeout, performance timing entry after builtin 
		 * 								timeout >40000
		 * [?] port instaclose no msg:	returns fast (net::ERR_SOCKET_NOT_CONNECTED)
		 * [+] port instaclose w/ msg:	returns fast, can be detected with fetch (+no-cors request)
		 * 								and with performance timing entry
		 * 
		 * # FF (Iceweasel 38.8.0 Debian 8.5 (64-bit)):
		 * [-] port no connection: 		returns fast
		 * [+] port closed no resp: 	returns fast, performance timing entry check possible 
		 * [+] port closed w/ resp: 	returns fast, performance timing entry check possible
		 * 								(might be also determined with newer fetch, needs to be checked with 
		 * 								newer version, >= 39, currently testing with 38.8) 
		 * [+] port opened no resp:		hangs until timeout, perf entry after builtin timeout (?) which is 
		 * 								very large: > 80000
		 * [+] port opened w/ resp: 	returns fast, BUT because we received some data we get a performance
		 * 								timing entry check possible 
		 * [+] port instaclose no msg:	returns very fast, perf timing entry check possible
		 * [+] port instaclose w/ msg:	returns very fast, perf timing entry check possible 
		 */
		function onResult(address, timing, info) {
			var status = "???";

			/* Update result with status and info we can directly derive */
			/* cannot scan */
			if (info === "BLOCKED") {
				info = "port is blocked by browser, cannot determine status!";
			}
			/* timing */
			else if (timing >= portScanTimeout) {
				status = "open";
			}
			/* response */
			else if ((info.indexOf(resultMsgData) !== -1)
				|| (info.indexOf(resultMsgConnected) !== -1)) {
				status = "open";
			}
			/* otherwise, no info */
			else {
				status = "closed";
			}

			results.push(new ScanResult(
				address,
				timing,
				status,
				info
			));

			if (results.length === ports.length) {
				/* check if we can add some additional info of perf timing API */
				NetScan._updateResultsWithPerfTimingData(results, "open");

				scanFinishedCB(results);
			}
		}

	}

	/**
	 * Merges and updates an array of scan results with data 
	 * obtained by the performance timing API. This API is still rapidly 
	 * changing, while developing FF behaviour changed and new entries are 
	 * getting added, like: https://w3c.github.io/resource-timing/#widl-PerformanceResourceTiming-nextHopProtocol
	 * @param {Array} results An array of entries of type ScanResult obtained by 
	 * one of the scan functions.
	 * @param {String} statusNew The new status that will be set when data can be 
	 * associated with a scan result.
	 */
	static _updateResultsWithPerfTimingData(results, statusNew) {
		/**
		 * differences in chrome: currently no entries for failed resources, see:
		 * https://bugs.chromium.org/p/chromium/issues/detail?id=460879
		 */
		if (results.length < 1 || !(results[0] instanceof ScanResult)) {
			return;
		}

		const connections = performance.getEntriesByType("resource").filter((entry) => {
			/* this is no longer valid... */
			//return entry.duration !== 0;

			/* From the spec: https://w3c.github.io/resource-timing/
				On getting, the fetchStart attribute MUST return as follows:
					- The time immediately before the user agent starts to fetch the final resource 
					  in the redirection, if there are HTTP redirects or equivalent.
					- The time immediately before the user agent starts to fetch the resource otherwise.
			
				On getting, the responseEnd attribute MUST return as follows:
					- The time immediately after the user agent receives the last byte 
					  of the response or immediately before the transport connection is closed, 
					  whichever comes first. The resource here can be received either from relevant 
					  application caches, or from local resources or from the server if the last 
					  non-redirected fetch of the resource passes the timing allow check algorithm.
					- zero, otherwise. 
			*/
			return entry.fetchStart !== entry.responseEnd;
		});

		for (let i = 0; i < connections.length; i++) {
			for (let j = 0; j < results.length; j++) {
				let entryName = connections[i].name;
				/* trim trailing slash */
				entryName = entryName.replace(/\/$/, "");
				/** 
				 * websocket (ws) connections are also named with http://
				 * ftp addresses dont get an entry, so we just replace everything with http
				 * ...for now
				 */
				const resultAddr = results[j].address.replace(/^.+?:\/\//, "http://")
					/* trim trailing slash */
					.replace(/\/$/, "");

				if (entryName === resultAddr) {
					results[j].status = statusNew;
					results[j].info += ", " + resultMsgPerfTiming;
					break;
				}
			}
		}
	}

	/**
	 * Purges the perfomance timing records of type "resource".
	 */
	static _clearPerfTimingData() {
		performance.clearResourceTimings();
	}

}
