/******************************************************************************
 *                               - NetScan.js -                                
 * A JavaScript library for client side host discovery and port scanning.
 * 
 * Author: Tobias Fink (e1026737@student.tuwien.ac.at)
 *****************************************************************************/

// eslint-disable-next-line no-unused-vars
var NetScan = (function () {
	"use strict";

	/* temp object for export */
	var Export = {};

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
	
	/**
	 * Feature detect, issues warning when something is not supported by the browser.
	 */
	if(!window.fetch){
		console.warn("This browser does not support the fetch API - lowered result accuracy!");
	} 
	if(!window.performance){
		console.warn("This browser does not support the performance API - lowered result accuracy!");
	} 
	if(!RTCPeerConnection){
		console.warn("This browser does not support the WebRTC API - cannot detect local IP!");
	}
	if(!window.WebSocket){
		console.warn("This browser does not support the WebSocket API - WebSocket scanning not possible!");
	}

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

	Export.Timer = Timer;

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Util contains all utility functions for parsing and converting data structures.
	 **/
	function Util(){}

	/**
	 * Parses a WebRTC SDP and gathers all public and private ip and port 
	 * combinations that can be found. 
	 * @param String candidate The candidate SDP string.
	 * @return Object Containing the entries type (the entry type),
	 * ip (private ip address), port (private port), public_ip (public ip), 
	 * public_port (public port), or null if nothing can be found, which is 
	 * only the case if no valid candidate line is in the string.
	 */
	Util.extractConnectionInfo = function(candidate){
		/**
		 * SDP candidate line structure (a=candidate:)
		 * 1 1 UDP 1686110207  80.110.26.244 50774 typ srflx raddr 192.168.2.108 rport 50774
		 * 2 1 UDP 25108223 	237.30.30.30 58779 typ relay raddr   47.61.61.61 rport 54761
		 * 0 			1 					UDP 				2122252543 		192.168.2.108 		52229 		typ host
		 * candidate | rtp (1)/rtcp (2) | protocol (udp/tcp) | priority 	| ip				| port		| type (host/srflx/relay)
		 **/
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

	/**
	 * Replaces ip and port in a WebRTC SDP candidate line string with 
	 * the data provided in replacement.
	 * @param String A string containing a SDP candidate line.
	 * @param Object replacement An object with ip and port properties which 
	 * will replace the original ip and port.
	 * @return The replaced string.
	 */
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

	/**
	 * Converts a string containing an ip4 address to an array of Numbers.
	 * @param String ip An ip4 address.
	 * @return Array containing the 4 octets as decimal numbers.
	 */
	Util.ipToArray = function(ip){
		return ip.split(".").map(Number);
	};

	/**
	 * Converts a range of ip addresses to an array which contains 
	 * all single addresses. (Expands the range.)
	 * @param String iprange A range of ip adresses, like "192.168.0.1-255"
	 * @return Array of ip strings.
	 */
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

	/**
	 * Converts a range of ports in string representation 
	 * to an array.
	 * @param String portrange A portrange (two valid ports separated by -).
	 * @return Array of ports (as Numbers).
	 */
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
	
	/**
	 * Parses a string of ports and/or port ranges and 
	 * creates an array containing all ports for easy 
	 * iteration.
	 * Example: "80,90,100-103" becomes [80,90,100,101,102,103]
	 * @param String portstring The string containing ports.
	 * @return Array of ports.
	 */
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
	
	/**
	 * Determines if a specific ip is a local address.
	 * @param String/Array ip The ip address.
	 * @return Bool True if the ip is local.
	 */
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
	
	/**
	 * Merges and updates an array of scan results with data 
	 * obtained by the performance timing API. This API is still rapidly 
	 * changing, while developing FF behaviour changed and new entries are 
	 * getting added, like: https://w3c.github.io/resource-timing/#widl-PerformanceResourceTiming-nextHopProtocol
	 * @param Array results An array of entries of type ScanResult obtained by 
	 * one of the scan functions.
	 * @param String statusNew The new status that will be set when data can be 
	 * associated with a scan result.
	 */
	Util.updateResultsWithPerfTimingData = function(results, statusNew){
		/**
		 * differences in chrome: currently no entries for failed resources, see:
		 * https://bugs.chromium.org/p/chromium/issues/detail?id=460879
		 */
		if(results.length < 1 || !(results[0] instanceof ScanResult)){
			return;
		}
		
		var connections = performance.getEntriesByType("resource").filter((entry) => {
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
		
		for(var i = 0; i < connections.length; i++){
			for(var j = 0; j < results.length; j++){
				var entryName = connections[i].name;
				/* trim trailing slash */
				entryName = entryName.replace(/\/$/, "");
				/** 
				 * websocket (ws) connections are also named with http://
				 * ftp addresses dont get an entry, so we just replace everything with http
				 * ...for now
				 */
				var resultAddr = results[j].address.replace(/^.+?:\/\//, "http://")
					/* trim trailing slash */
					.replace(/\/$/, "");
				
				if(entryName === resultAddr){
					results[j].status = statusNew;
					results[j].info += "; "+ Scan.resultMsgPerfTiming;
					break;
				}
			}
		}
	};
	
	/**
	 * Purges the perfomance timing records of type "resource".
	 */
	Util.clearPerfTimingData = function(){
		performance.clearResourceTimings();
	};
	
	
	Export.Util = Util;


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
	Scan.maxConcurrentHTMLRequests = 5; /* 	This value should be kept very low (<= 10), 
											otherwise many wrong results will be produced */
	
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

	/**
	 * Result messages used internally.
	 **/
	Scan.resultMsgTimeout = "NETWORK TIMEOUT";
	Scan.resultMsgError = "NETWORK ERROR";
	Scan.resultMsgData = "DATA RECEIVED";
	Scan.resultMsgConnected = "CONNECTION OPENED";
	Scan.resultMsgDisconnected = "CONNECTION CLOSED";
	Scan.resultMsgPerfTiming = "PERF-TIMING CONNECTION RECORD";

	/**
	 * Retrieves all private and public ip addresses
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
				//console.log("Got candidate:", candidate.candidate);

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
				//console.log("getting ip took:", Timer.duration("getHostIps"));
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
				/* check if we can add some additional info of perf timing API */
				Util.updateResultsWithPerfTimingData(results, "up");
				
				scanFinishedCB(results);
			}
		}
		
		/* clear all perftiming entries for reliable results */
		Util.clearPerfTimingData();
		
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
			
			if(info === Scan.resultMsgConnected){
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
		Util.clearPerfTimingData();

		/* initially fill pool */
		for(var i = 0; i < Scan.poolCap && ips.length > 0; i++){
			Scan.createConnectionWS(protocol + ips.shift(), handleSingleResult);			
		}

		/* then regularly check if there is space for new conns */
		var poolMonitor = setInterval(function(){
			if(ips.length < 1 && Scan.socketPool.length === 0){
				/* finished */
				clearInterval(poolMonitor);

				/* check if we can add some additional info of perf timing API */
				Util.updateResultsWithPerfTimingData(results, "up");
				
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
		p.then((/* resp */) => {
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
			
			if(info === Scan.resultMsgData){
				status = "up";	
			}
			
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));

			/* last result received, return */
			if(results.length === addresses.length){
				/* check if we can add some additional info of perf timing API */
				Util.updateResultsWithPerfTimingData(results, "up");
				
				scanFinishedCB(results);
			}
		}
		
		/* clear all perftiming entries for reliable results */
		Util.clearPerfTimingData();
		
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
			/* this will cancel the request */
			request.onload = request.onerror = function(){};
			request.src = "";
		}, connectionTimeout);
		
		startTime = Timer.getTimestamp();
		/* start the request */
		request.src = address;
	};
	
	
	/**
	 * Performs a scan by creating requests through html elements on an ip range and 
	 * interprets the results which will be passed to the callback 
	 * as soon as the scan process has finished.
	 * @param String iprange A range of ips.
	 * @param Function scanFinishedCB The callback which gets the results.
	 * 		Array results Containing result objects for each address.
	 **/
	Scan.getHostsHTML = function(iprange, scanFinishedCB){
		var results = [];
		var protocol = "http://";
		var addresses = Util.ipRangeToArray(iprange);
		/* Needed because we can only make a very small amount of simultaneous requests... */
		var concurrentRequests = 0;
		var requestsMade = 0;

		function handleSingleResult(address, timing, info){
			concurrentRequests--;
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			
			if(info === Scan.resultMsgData){
				status = "up";	
			}
			
			results.push(new ScanResult(
				address, 
				timing, 
				status, 
				info
			));

			/* last result received, return */
			if(results.length === addresses.length){
				/* check if we can add some additional info of perf timing API */
				Util.updateResultsWithPerfTimingData(results, "up");
				
				scanFinishedCB(results);
			}
		}
		
		/* clear all perftiming entries for reliable results */
		Util.clearPerfTimingData();
		
		var requestMonitor = setInterval(function(){
			if(requestsMade >= addresses.length){
				clearInterval(requestMonitor);
			}
			else {
				if(concurrentRequests < Scan.maxConcurrentHTMLRequests
				&& requestsMade < addresses.length){
					Scan.createConnectionHTML(protocol + addresses[requestsMade], handleSingleResult);
					concurrentRequests++;
					requestsMade++;
				}				
			}
		}, 100);
		
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


	/**
	 * Scans the specified ports of a host and tries to 
	 * determine their status (whether they are open or closed).
	 * 
	 * @param String host The host to scan.
	 * @param String portrange A string containing a range/list of ports.
	 * The string can contain a single port, a comma separated list of ports 
	 * or a range (two ports separated by a '-' character), or a mixture of 
	 * them.
	 * @param Function scanFinishedCB Callback which will receive the results as soon as 
	 * the scan is complete. An array containing result objects for each port will be passed
	 * as argument to the callback.
	 * @param Function scanFunction One of the 'Scan.createConnection*'-functions which will be
	 * used to perform the scan on each individual port. The default is Scan.createConnectionFetch.
	 **/
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
		
		/* clear all perftiming entries for reliable results */
		Util.clearPerfTimingData();

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
		 **/
		function onResult(address, timing, info){
			var status = "???";
			
			/* Update result with status and info we can directly derive */
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

			if(results.length === ports.length){
				/* check if we can add some additional info of perf timing API */
				Util.updateResultsWithPerfTimingData(results, "open");
				
				scanFinishedCB(results);
			}
		}

	};

	Export.Scan = Scan;

	////////////////////////////////////////////////////////////////////////////////

	return Export;
}());
