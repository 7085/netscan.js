
var NetScan = (function () {
	"use strict";

	/* temp object for export */
	var T = {};

	/* compatibility: see https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection */
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


	/****************************/

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

	

	/****************************/
	/* SDP candidate line structure (a=candidate:)
	 * 1 1 UDP 1686110207  80.110.26.244 50774 typ srflx raddr 192.168.2.108 rport 50774
	 * 2 1 UDP 25108223 	237.30.30.30 58779 typ relay raddr   47.61.61.61 rport 54761
	 * 0 			1 					UDP 				2122252543 		192.168.2.108 		52229 		typ host
	 * candidate | rtp (1)/rtcp (2) | protocol (udp/tcp) | priority 	| ip				| port		| type (host/srflx/relay)
	 */
	
	function Util(){}

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
		var range = [];
		if(portrange.indexOf("-") !== -1){
			range = portrange.split("-").map(Number);
		}
		else {
			range = [Number(portrange), Number(portrange)];
		}

		var ports = [];
		for(var i = range[0]; i <= range[1]; i++){
			ports.push(i);
		}

		return ports;
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


	/**********************************/

	function Scan(){}

	Scan.socketPool = [];
	Scan.poolCap = 130;
	Scan.timingLowerBound = 2900;
	Scan.timingUpperBound = 10000;
	Scan.xhrTimeout = 20000;
	Scan.wsoTimeout = 20000;
	Scan.fetchTimeout = 20000;
	Scan.portScanBufferSize = 100;
	// TODO separate timing bounds for ws and xhr
/*
	Scan.scanTypes = {
		WS: 1,
		XHR: 2,
		FETCH: 3
	};
*/

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
			/* at this state (evt.candidate == null) we are finished, see:
			 * https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection/onicecandidate */
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
				function(error){/* dont care */});
		} 
		catch(/* TypeError */ error){

			/* Fallback for older version of createOffer which requires 
			 * two callbacks instead of the newer Promise which will be returned */
			conn.createOffer(
				function(offerDesc){
					conn.setLocalDescription(offerDesc);
				},
				function(error){/* dont care */});
		}
	};


	/* handleResultCB:
		string address
		number timing
		string info
	 */
	Scan.createConnectionXHR = function(address, handleSingleResult){
		try {
			var x = new XMLHttpRequest();
			var startTime = 0;
			x.onreadystatechange = function(){
				//console.log(x.readyState, x.getAllResponseHeaders());
				if(x.readyState === 4){
					var timing = Timer.getTimestamp() - startTime;
					//var status = time < Scan.timingLowerBound || time > Scan.timingUpperBound ? "up" : "down";
					//console.log(time);
					handleSingleResult(address, timing, "");
				}
			};
			x.open("HEAD", address, true);
			x.timeout = Scan.xhrTimeout;

			startTime = Timer.getTimestamp();			
			x.send();
		} 
		catch (err){
			//console.log(err);
			handleSingleResult(address, 0, err.toString());
		}
	}


	Scan.getHostsXHR = function(iprange, scanFinishedCB){
		// TODO use resource timing api
		// differences in chrome: currently no entries for failed resources, see:
		// https://bugs.chromium.org/p/chromium/issues/detail?id=460879
		var results = [];
		var protocol = "http://";
		var addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push({
				ip: address, 
				time: timing, 
				status: status, 
				info: info
			});

			/* last result received, return */
			if(results.length === addresses.length){
				scanFinishedCB(results);
			}
		}
		
		for(var i = 0; i < addresses.length; i++){
			Scan.createConnectionXHR(protocol + addresses[i], handleSingleResult);
		}
	};


	/* create a single connection */
	Scan.createConnectionWS = function(address, handleSingleResult){
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

			ws.onopen = function(evt){
				onresult(address, Timer.getTimestamp() - startTime, "WS opened");
			};

			ws.onclose = function(/*CloseEvent*/ evt){
				if(evt.code === 4999 && evt.reason === "NetScan"){
					onresult(address, Timer.getTimestamp() - startTime, "WS closed by timeout");
				}
				else {
					onresult(address, Timer.getTimestamp() - startTime, "WS closed");
				}
			};

			ws.onerror = function(evt){
				onresult(address, Timer.getTimestamp() - startTime, "WS error event");
			};

			Scan.socketPool.push(ws);

			/* trigger a manual close after some time, identified by "code" and "reason"
			 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes */
			timeout = setTimeout(function(){
				ws.close(4999, "NetScan");
			}, Scan.wsoTimeout);

			// TODO: handle blocking of http authentication (in FF)

			// TODO: try secure sockets (wss)


		} 
		catch(err) {
			//console.log(err);
			handleSingleResult(address, 0, "WS address error: "+ err.toString());
		}
	}


	Scan.getHostsWS = function(iprange, scanFinishedCB){
		/* create a connection pool, browsers only support a certain limit of
		 * simultaneous connections (ff ~200) */	
		var results = [];
		var protocol = "ws://";
		var ips = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push({
				ip: address, 
				time: timing, 
				status: status, 
				info: info
			});
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


	Scan.createConnectionFetch = function(address, handleSingleResult){
		var config = {
			method: "GET",
			/**	
			 *	This will make an "opaque" request, so we will
			 *	know when HTTP is understood by the remote host.
			 *	CORS requests will succeed and the response gets
			 *	"nulled".
			 **/
			mode: "no-cors",
			/* Always make real requests, don't use the cache. */
			cache: "no-store"
		};
		var startTime = Timer.getTimestamp();

		var timeout = new Promise((resolve, reject) => {
			setTimeout(() => reject("fetchTimeout triggered"), Scan.fetchTimeout);
		});

		var requ = fetch(address, config);

		var p = Promise.race([timeout, requ]);
		p.then((resp) => {
			console.log(resp.headers);
			console.log(resp.type, resp.ok, resp.status, resp.statusText);
			resp.text().then((body) => {
				console.log(body);
			});
			handleSingleResult(address, Timer.getTimestamp() - startTime, "HTTP available");
		})
		.catch(/* TypeError */ err => {
			//console.log(err);
			handleSingleResult(address, Timer.getTimestamp() - startTime, "network error: "+ err.message);
		});
	}


	Scan.getHostsFetch = function(iprange, scanFinishedCB){
		var results = [];
		var protocol = "http://";
		var addresses = Util.ipRangeToArray(iprange);

		function handleSingleResult(address, timing, info){
			var status = timing < Scan.timingLowerBound || timing > Scan.timingUpperBound ? "up" : "down";
			results.push({
				ip: address, 
				time: timing, 
				status: status, 
				info: info
			});

			/* last result received, return */
			if(results.length === addresses.length){
				scanFinishedCB(results);
			}
		}
		
		for(var i = 0; i < addresses.length; i++){
			Scan.createConnectionFetch(protocol + addresses[i], handleSingleResult);
		}
	};


	Scan.getHostsLocalNetwork = function(scanFinishedCB, scanFunction = Scan.getHostsWS){
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


	Scan.getPorts = function(host, portrange, scanFinishedCB){
		var ports = Util.portRangeToArray(portrange);
		/* Browser port restrictions, can be found in the fetch spec:
		 * https://fetch.spec.whatwg.org/#port-blocking 
		 * those seem to be enforced to all kinds of connections
		 * creating a websocket will instantly fail with an exception, 
		 * a xhr will be blocked when the request is sent and returns very fast
		 * The specific list can be found at:
		 * - CHROME/CHROMIUM: https://src.chromium.org/viewvc/chrome/trunk/src/net/base/net_util.cc?view=markup 
		 * - FF: http://www-archive.mozilla.org/projects/netlib/PortBanning.html#portlist 
		 * a few exceptions exist, depending on a specific protocol, e.g. FTP allows 21 and 22 */
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
				onResultXHR(url, 0, "BLOCKED");
			}
			else {
				doRequestXHR(url);
			}
			
		}

		function doRequestXHR(url){
			Scan.createConnectionXHR(url, function(address, timing, info){
				onResultXHR(address, timing, info);
			});
		}

		/*	
			Timings gathered (active host):
			# chromium
			- port not open (net::ERR_CONNECTION_REFUSED): 5-31 ms
			- port closed after open (net::ERR_EMPTY_RESPONSE): 5-14 ms, no significance
			- port closed with msg: 5-14ms, slightly slower than closed ports, about ~1ms
			- port open no resp: hangs until timeout
			- port open w/ resp: higher thant closed ones, about ~1-2ms

		*/
		function onResultXHR(address, timing, info){
			var status = "???"; // TODO
			if(info === "BLOCKED"){
				status = info;
				info = "Port is blocked by browser.";
			}

			results.push({
				ip: address, 
				time: timing, 
				status: status, 
				info: info
			});

			if(results.length === ports.length){
				scanFinishedCB(results);
			}
		}

	};

	T.Scan = Scan;

	/**********************************/

	


	return T;
}());
