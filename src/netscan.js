/**
 * // TODO description
 * Author: Tobias Fink
 **/

// eslint-disable-next-line no-unused-vars
var NetScan = (function () {
	"use strict";

	/* temp object for export */
	var T = {};

	////////////////////////////////////////////////////////////////////////////////

	/** 
	 * compatibility: see https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection 
	 **/
	/* eslint-disable no-unused-vars */
	var RTCPeerConnection = window.RTCPeerConnection 
		|| window.mozRTCPeerConnection 
		|| window.webkitRTCPeerConnection 
		|| window.msRTCPeerConnection;
	var RTCSessionDescription = window.RTCSessionDescription 
		|| window.mozRTCSessionDescription 
		|| window.webkitRTCSessionDescription 
		|| window.msRTCSessionDescription;
	navigator.getUserMedia = navigator.getUserMedia 
		|| navigator.mozGetUserMedia 
		|| navigator.webkitGetUserMedia 
		|| navigator.msGetUserMedia;
	var RTCIceCandidate = window.RTCIceCandidate 
		|| window.mozRTCIceCandidate 
		|| window.webkitRTCIceCandidate 
		|| window.msRTCIceCandidate;
	/* eslint-enable no-unused-vars */

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Timer contains utility functions for time measurement.
	 **/
	function Timer(){}

	Timer.start = function(name){
		window.performance.mark("start_"+ name);
	};

	Timer.stop = function(name){
		window.performance.mark("stop_"+ name);
	};

	Timer.duration = function(name){
		window.performance.measure("dur_"+ name, "start_"+ name, "stop_"+ name);
		return performance.getEntriesByName("dur_"+ name, "measure")[0].duration; // in ms
	};

	Timer.durationInSec = function(name){
		return (Timer.duration(name) / 1000).toFixed(3);
	};

	Timer.durationDiff = function(startName, stopName){
		window.performance.measure("dur_"+ startName + stopName, "start_"+ startName, "stop_"+ stopName);
		return performance.getEntriesByName("dur_"+ startName + stopName, "measure")[0].duration; // in ms
	};

	Timer.durationDiffInSec = function(startName, stopName){
		return (Timer.durationDiff(startName, stopName) / 1000).toFixed(3);
	};

	Timer.getTimestamp = function(){
		return window.performance.now(); // in ms, micro-seconds fraction
	};

	T.Timer = Timer;

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Util contains all utility functions for parsing and converting data structures.
	 **/
	function Util(){}

	/**
	 * SDP candidate line structure (a=candidate:)
	 * 1 1 UDP 1686110207  80.110.26.244 50774 typ srflx raddr 192.168.2.108 rport 50774
	 * 2 1 UDP 25108223 	237.30.30.30 58779 typ relay raddr   47.61.61.61 rport 54761
	 * 0 			1 					UDP 				2122252543 		192.168.2.108 		52229 		typ host
	 * candidate | rtp (1)/rtcp (2) | protocol (udp/tcp) | priority 	| ip				| port		| type (host/srflx/relay)
	 **/
	Util.extractConnectionInfo = function(candidate){
		var host = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate);
		if(host !== null && host.length === 3){
			return {type: "host", ip: host[1], port: host[2], public_ip: null, public_port: null};
		}

		var srflx = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ srflx raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);
		if(srflx !== null && srflx.length === 5){
			return {type: "srflx", ip: srflx[3], port: srflx[4], public_ip: srflx[1], public_port: srflx[2]};
		}

		var relay = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ relay raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);
		if(relay !== null && relay.length === 5){
			return {type: "relay", ip: relay[3], port: relay[4], public_ip: relay[1], public_port: relay[2]};
		}

		return null;
	};

	Util.replaceConnectionInfo = function(candidate, replacement){
		var m = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate)
			|| /((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate);

		if(m !== null){
			var t = candidate.replace(m[1], replacement.ip);
			t = t.replace(m[2], replacement.port);
			return t;
		}

		return candidate;
	};

	Util.ipToArray = function(ip){
		return ip.split(".").map(Number);
	};

	Util.ipRangeToArray = function(iprange){
		var ranges = [];
		iprange.split(".").map(function(elem){
			if(elem.indexOf("-") !== -1){
				ranges.push(elem.split("-").map(Number));
			}
			else {
				var n = Number(elem);
				ranges.push([n, n]);
			}
		});

		var ips = [];
		for(var i = ranges[0][0]; i <= ranges[0][1]; i++){
			for(var j = ranges[1][0]; j <= ranges[1][1]; j++){
				for(var k = ranges[2][0]; k <= ranges[2][1]; k++){
					for(var l = ranges[3][0]; l <= ranges[3][1]; l++){
						ips.push([i,j,k,l].join("."));
					}			
				}			
			}			
		}

		return ips;
	};

	Util.portRangeToArray = function(portrange){
		if(portrange.indexOf("-") !== -1){
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
	};
	
	Util.portStringToArray = function(portstring){
		if(portstring.indexOf(",") !== -1){
			var ports = [];
			portstring.split(",").map((val) => {
				ports = ports.concat(Util.portRangeToArray(val));
			});
			return ports;
		}
		else {
			return Util.portRangeToArray(portstring);
		}
	};
	
	Util.isPrivateIp = function(ip){
		if(typeof ip === "string"){
			ip = Util.ipToArray(ip);
		}

		if(ip[0] === 10
		||(ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)
		||(ip[0] === 192 && ip[1] === 168)){
			return true;
		}
	};
	
	T.Util = Util;


	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Data object used for scan results.
	 **/
	function ScanResult(address, duration, status, info){
		this.address = address; 
		this.duration = duration;
		this.status = status;
		this.info = info;
	}
	
	ScanResult.prototype.toString = function(){
		return "ScanResult for '"+ this.address +"', duration: "+ this.duration +", status: "+ this.status +", info: "+ this.info;  
	};
	
	ScanResult.prototype.toTableString = function(){
		return "<tr><td>"+ this.address +"</td><td>"+ this.status +"</td><td>"+ this.duration +"</td><td>"+ this.info +"</td></tr>";
	};
	
	////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Scan namespace.
	 **/
	function Scan(){}

	/**
	 * Internal variables.
	 **/
	Scan.socketPool = [];
	Scan.poolCap = 130;
	
	/**
	 * Timing default settings.
	 **/
	Scan.timingLowerBound = 2900;
	Scan.timingUpperBound = 10000;
	Scan.xhrTimeout = 20000;
	Scan.wsoTimeout = 20000;
	Scan.fetchTimeout = 20000;
	Scan.htmlTimeout = 20000;
	Scan.portScanTimeout = 5000;
	// TODO separate timing bounds for ws and xhr

	/**
	 * Result messages used internally.
	 **/
	Scan.resultMsgTimeout = "NETWORK TIMEOUT";
	Scan.resultMsgError = "NETWORK ERROR";
	Scan.resultMsgData = "DATA RECEIVED";
	Scan.resultMsgConnected = "CONNECTION OPENED";
	Scan.resultMsgDisconnected = "CONNECTION CLOSED";

	/**
	 * Retrieves all private and public ip address
	 * and ports assigned to the current host.
	 * @param Function cbReturn
	 * 	Gets a list of ip and port combinations which were
	 * 	found in the gathering process.
	 **/
	Scan.getHostIps = function(cbReturn){
		Timer.start("getHostIps");
		var ips = [];

		var serverConfig = {
			iceServers: [
				{urls: ["stun:stun.l.google.com:19302"]}
			]
		};

		var conn = new RTCPeerConnection(serverConfig, null);
		var sendChan = conn.createDataChannel("netscan", null);

		conn.onicecandidate = function(evt){
			if(evt.candidate !== null){
				var candidate = evt.candidate;
				console.log("Got candidate:", candidate.candidate);

				var host = Util.extractConnectionInfo(candidate.candidate);
				if(host !== null){
					ips.push(host);
				}
			}
			/** 
			 * At this state (evt.candidate == null) we are finished, see:
			 * https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection/onicecandidate 
			 **/
			else { 
				Timer.stop("getHostIps");
				sendChan.close();
				conn.close();
				sendChan = null;
				conn = null;
				console.log("getting ip took:", Timer.duration("getHostIps"));
				cbReturn(ips);
			}
		};

		try {
			conn.createOffer()
				.then(function(offerDesc){
					conn.setLocalDescription(offerDesc);
				},
				// eslint-disable-next-line no-unused-vars
				function(error){/* dont care */});
		} 
		catch(/* TypeError */ error){

			/**
			 * Fallback for older version of createOffer which requires 
			 * two callbacks instead of the newer Promise which will be returned 
			 **/
			conn.createOffer(
				function(offerDesc){
					conn.setLocalDescription(offerDesc);
				},
				// eslint-disable-next-line no-unused-vars
				function(error){/* dont care */});
		}
	};


	/**
	 * Creates a single connection by using a XMLHttpRequest.
	 * @param String address The address to scan.
	 * @param Function handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param Number connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 **/
	Scan.createConnectionXHR = function(address, handleSingleResult, connectionTimeout = Scan.xhrTimeout){
		try {
			var startTime = 0;
			var lastChangeTime = 0;
			var diff = 0;
			var info = "";
			
			var x = new XMLHttpRequest();
			x.timeout = connectionTimeout;
			
			x.onreadystatechange = function(){
				switch (x.readyState) {
				case 2: // HEADERS_RECEIVED
					diff = Timer.getTimestamp() - lastChangeTime;
					lastChangeTime = Timer.getTimestamp();
					info += diff + "::";
					break;
					
				case 3: // LOADING
					diff = Timer.getTimestamp() - lastChangeTime;
					lastChangeTime = Timer.getTimestamp();
					info += diff + "::";
					break;
					
				case 4: // DONE
					diff = Timer.getTimestamp() - lastChangeTime;
					lastChangeTime = Timer.getTimestamp();
					info += diff;
					
					var timing = lastChangeTime - startTime;
					handleSingleResult(address, timing, info);
					break;
					
				default:
					/* we don't care about other states (OPENED, UNSENT) */
					break;
				}
			};
			
			startTime = lastChangeTime = Timer.getTimestamp();
			
			x.open("HEAD", address, true);			
			x.send();
		} 
		catch (err){
			//console.log(err);
			handleSingleResult(address, 0, Scan.resultMsgError + " ("+ err.toString() +")");
		}
	};


	/**
	 * Performs a scan with XMLHttpRequests on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param String iprange A range of ips.
	 * @param Function scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 **/
	Scan.getHostsXHR = function(iprange, scanFinishedCB){
		// TODO use resource timing api
		// differences in chrome: currently no entries for failed resources, see:
		// https://bugs.chromium.org/p/chromium/issues/detail?id=460879
		var results = [];
		var protocol = "http://";
		var addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));

			/* last result received, return */
			if(results.length === addresses.length){
				scanFinishedCB(results);
			}
		}
		
		for(var i = 0; i < addresses.length; i++){
			Scan.createConnectionXHR(protocol + addresses[i], handleSingleResult);
		}
	};


	/**
	 * Creates a single connection by using a WebSocket.
	 * @param String address The address to scan.
	 * @param Function handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param Number connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 **/
	Scan.createConnectionWS = function(address, handleSingleResult, connectionTimeout = Scan.wsoTimeout){
		var startTime = Timer.getTimestamp();
		var wsResult = false;
		var timeout,
			ws;

		function onresult(address, timing, info){
			if(!wsResult){
				clearTimeout(timeout);
				wsResult = true;
		
				Scan.socketPool.splice(Scan.socketPool.indexOf(ws), 1);
				ws.close();
				ws = null;

				handleSingleResult(address, timing, info);
			}
		}

		try {
			ws = new WebSocket(address);

			ws.onopen = function(/* evt */){
				onresult(address, Timer.getTimestamp() - startTime, Scan.resultMsgConnected);
			};

			ws.onclose = function(/*CloseEvent*/ evt){
				if(evt.code === 4999 && evt.reason === Scan.resultMsgTimeout){
					onresult(address, Timer.getTimestamp() - startTime, Scan.resultMsgTimeout);
				}
				else {
					onresult(address, Timer.getTimestamp() - startTime, Scan.resultMsgDisconnected);
				}
			};

			ws.onerror = function(/* evt */){
				onresult(address, Timer.getTimestamp() - startTime, Scan.resultMsgError);
			};

			Scan.socketPool.push(ws);

			/* trigger a manual close after some time, identified by "code" and "reason"
			 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes */
			timeout = setTimeout(function(){
				ws.close(4999, Scan.resultMsgTimeout);
			}, connectionTimeout);

			// TODO: handle blocking of http authentication (in FF)
		} 
		catch(err) {
			handleSingleResult(address, 0, Scan.resultMsgError + " ("+ err.toString() +")");
		}
	};


	/**
	 * Performs a scan with WebSockets on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param String iprange A range of ips.
	 * @param Function scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 **/
	Scan.getHostsWS = function(iprange, scanFinishedCB){
		/* create a connection pool, browsers only support a certain limit of
		 * simultaneous connections for websockets (ff ~200) */	
		var results = [];
		var protocol = "ws://";
		var ips = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));
		}

		/* initially fill pool */
		for(var i = 0; i < Scan.poolCap && ips.length > 0; i++){
			Scan.createConnectionWS(protocol + ips.shift(), handleSingleResult);			
		}

		/* then regularly check if there is space for new conns */
		var poolMonitor = setInterval(function(){
			if(ips.length < 1 && Scan.socketPool.length === 0){
				/* finished */
				clearInterval(poolMonitor);

				// TODO add/merge/compare results of perf resource timing api
				
				scanFinishedCB(results);
			}

			while(Scan.socketPool.length < Scan.poolCap && ips.length > 0){
				Scan.createConnectionWS(protocol + ips.shift(), handleSingleResult);			
			}

		}, 50);

	};


	/**
	 * Creates a single connection by using the fetch API.
	 * @param String address The address to scan.
	 * @param Function handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param Number connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 **/
	Scan.createConnectionFetch = function(address, handleSingleResult, connectionTimeout = Scan.fetchTimeout){
		var config = {
			method: "GET",
			/**	
			 *	This will make an "opaque" request, such that CORS requests 
			 * 	will succeed even if there is no "CORS header". The response gets
			 *	"nulled", but we will know when HTTP is understood by the remote host.
			 **/
			mode: "no-cors",
			/* Always make a "new / real" request, don't use possibly cached versions. */
			cache: "no-store"
		};
		var startTime = Timer.getTimestamp();

		var timeout = new Promise((resolve, reject) => {
			setTimeout(() => reject(new Error(Scan.resultMsgTimeout)), connectionTimeout);
		});

		var requ = fetch(address, config);

		var p = Promise.race([timeout, requ]);
		p.then((resp) => {
			// console.log(resp.headers);
			// console.log(resp.type, resp.ok, resp.status, resp.statusText);
			// resp.text().then((body) => {
			// 	console.log(body);
			// });
			handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgData);
		})
		.catch(/* TypeError */ err => {
			if(err.message === Scan.resultMsgTimeout){
				handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgTimeout);
			}
			else {
				handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgError + " ("+ err.toString() +")");	
			}
		});
	};


	/**
	 * Performs a scan with fetch API requests on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param String iprange A range of ips.
	 * @param Function scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 **/
	Scan.getHostsFetch = function(iprange, scanFinishedCB){
		var results = [];
		var protocol = "http://";
		var addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));

			/* last result received, return */
			if(results.length === addresses.length){
				scanFinishedCB(results);
			}
		}
		
		for(var i = 0; i < addresses.length; i++){
			Scan.createConnectionFetch(protocol + addresses[i], handleSingleResult);
		}
	};


	/**
	 * Creates a single connection by using a HTML element.
	 * @param String address The address to scan.
	 * @param Function handleSingleResult A Function which will get the 
	 * result information through following parameters:
	 *		String address The address which was scanned.
	 *		Number timing The duration of the connection.
	 *		String info Additional information about the connection, state
	 *			changes and other interesting details.
	 * @param Number connectionTimeout The time in milliseconds after which 
	 * the connection will be forcefully closed.
	 **/
	Scan.createConnectionHTML = function(address, handleSingleResult, connectionTimeout = Scan.htmlTimeout){
		var request = new Image();
		var timeout,
			startTime;
		
		request.onerror = function(/* evt */){
			clearTimeout(timeout);
			handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgError);
		};
		
		request.onload = function(/* evt */){
			clearTimeout(timeout);
			handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgData);
		};
		
		timeout = setTimeout(function(){
			handleSingleResult(address, Timer.getTimestamp() - startTime, Scan.resultMsgTimeout);
		}, connectionTimeout);
		
		startTime = Timer.getTimestamp();
		/* start the request */
		request.src = address;
	};


	/**
	 * Scans all hosts in the current local network.
	 * The local network will be determined automatically.
	 * @param Function scanFinishedCB Callback which will receive the results as soon as 
	 * 		the scan is complete.
	 * 		Array results Containing result objects for each address.
	 * @param Function scanFunction (optional) One of the available functions
	 * 		for scanning an iprange can be provided. The default is the function using 
	 * 		the fetch API.
	 **/
	Scan.getHostsLocalNetwork = function(scanFinishedCB, scanFunction = Scan.getHostsFetch){
		Scan.getHostIps(function(ips){
			var toTest = {};
			var testCount = 0, 
				testedCount = 0;
			var all = [];
			
			function resultAccumulator(res){
				all = all.concat(res);
				testedCount++;
				if(testedCount === testCount){
					scanFinishedCB(all);
				}
			}

			for(var i = 0; i < ips.length; i++){
				if(toTest[ips[i].ip] === undefined){
					toTest[ips[i].ip] = true;
					testCount++;
				}
			}

			for(var ip in toTest){
				var tip = Util.ipToArray(ip);
				tip[3] = "0-255";
				tip = tip.join(".");
				scanFunction(tip, resultAccumulator);
			}
		});
	};


	Scan.getPorts = function(host, portrange, scanFinishedCB, scanFunction = Scan.createConnectionFetch){
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
		 **/
		var blocked = [
			1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 
			42, 43, 53, 77, 79, 87, 95, 101, 102, 103, 104, 109, 
			110, 111, 113, 115, 117, 119, 123, 135, 139, 143, 179, 
			389, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 
			556, 563, 587, 601, 636, 993, 995, 2049, 3659, 4045, 
			6000, 6665, 6666, 6667, 6668, 6669
		];

		var results = [];

		for(var i = 0; i < ports.length; i++){
			var url = "http://"+ host +":"+ ports[i];
			if(blocked.indexOf(ports[i]) !== -1){
				/* exception which can be resolved by ftp */
				if(ports[i] === 21 || ports[i] === 22){
					url = "ftp://"+ host +":"+ ports[i];
					/* note: only html scan can connect to ftp addresses */
					Scan.createConnectionHTML(url, onResult, Scan.portScanTimeout);
				}
				else {
					onResult(url, 0, "BLOCKED");	
				}
			}
			else {
				scanFunction(url, onResult, Scan.portScanTimeout);
			}
		}

		/**
		 * Observations (when host is up):
		 * -------------------------------
		 * legend:
		 * [+] = can be detected
		 * [-] = cannot be distinguished 
		 * [?] = needs further investigation
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
		 * 
		 * # FF (Iceweasel 38.8.0 Debian 8.5 (64-bit)):
		 * [-] port no connection: 		returns fast
		 * [+] port closed no resp: 	returns fast, performance entry
		 * [+] port closed w/ resp: 	returns fast, [DEPRECATED:-although-data-is-sent,-no-further-indicators-],
		 * 								performance timing entry
		 * 								(might be determined with newer fetch, needs to be checked with 
		 * 								newer version, >= 39, currently testing with 38.8) 
		 * [+] port opened no resp:		hangs until timeout, perf entry after builtin timeout (?) which is 
		 * 								very large: > 80000
		 * [+] port opened w/ resp: 	returns fast, BUT because we received some data we get a performance
		 * 								timing entry with duration != 0 -> win :)
		 **/
		function onResult(address, timing, info){
			var status = "???";
			
			/* cannot scan */
			if(info === "BLOCKED"){
				info = "port is blocked by browser, cannot determine status!";
			}
			/* timing */
			else if(timing >= Scan.portScanTimeout){
				status = "open";
			}
			/* response */
			else if((info.indexOf(Scan.resultMsgData) !== -1)
			|| (info.indexOf(Scan.resultMsgConnected) !== -1)){
				status = "open";
			}
			// TODO
			
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));

			if(results.length === ports.length){
				scanFinishedCB(results);
			}
		}

	};

	T.Scan = Scan;

	////////////////////////////////////////////////////////////////////////////////

	return T;
}());
