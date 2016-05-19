
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
	
	function Util(){};

	Util.extractConnectionInfo = function(candidate){
		var host = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate);
		if(host !== null && host.length === 3){
			return {type: "host", ip: host[1], port: host[2], public_ip: null, public_port: null};
		}

		var srflx = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ srflx raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate)
		if(srflx !== null && srflx.length === 5){
			return {type: "srflx", ip: srflx[3], port: srflx[4], public_ip: srflx[1], public_port: srflx[2]};
		}

		var relay = /((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ relay raddr ((?:\d{1,3}\.){3}\d{1,3}) rport (\d{1,5})/.exec(candidate)
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
				ranges.push(elem.split("-").map(Number))
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

	function Scan(){};

	Scan.socketPool = [];
	Scan.poolCap = 50;
	Scan.timingLowerBound = 2900;
	Scan.timingUpperBound = 10000;
	Scan.xhrTimeout = 20000;
	Scan.wsoTimeout = 20000;

	Scan.getIps = function(cb){
		Timer.start("getIps");
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
				Timer.stop("getIps");
				cb(ips);
				sendChan.close();
				conn.close();
				sendChan = null;
				conn = null;
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
	
	Scan.getHostsXHR = function(iprange, cb){
		// TODO use resource timing api
		var results = [];
		var ips = Util.ipRangeToArray(iprange);
		var startTime = 0;
		
		for(var i = 0; i < ips.length; i++){
			createConnection(ips[i]);
		}

		function createConnection(ip){
			try {
				var x = new XMLHttpRequest();
				x.onreadystatechange = function(){
					console.log(x.readyState, x.getAllResponseHeaders());
					if(x.readyState === 4){
						var time = Timer.getTimestamp() - startTime;
						var status = time < Scan.timingLowerBound || time > Scan.timingUpperBound ? "up" : "down";
						console.log(time);
						results.push({ip: ip, status: status, time: time});
						if(results.length === ips.length){
							cb(results);
						}
					}
				};
				x.open("HEAD", "http://"+ ips[i], true);
				x.timeout = Scan.xhrTimeout;

				startTime = Timer.getTimestamp();			
				x.send();
			} catch (err){
				console.log(err);
			}
		}
	};

	Scan.getHostsWS = function(iprange, cb){
		/* create a connection pool, browsers only support a certain limit of
		 * simultaneous connections */	
		//var poolCap = 50;	
		//var socketPool = [];
		var results = [];
		var ips = Util.ipRangeToArray(iprange);

		/* initially fill pool */
		for(var i = 0; i < Scan.poolCap && ips.length > 0; i++){
			createConnection(ips.shift());			
		}

		/* then regularly check if there is space for new conns */
		var poolMonitor = setInterval(function(){
			if(ips.length < 1 && Scan.socketPool.length === 0){
				/* finished */
				clearInterval(poolMonitor);
				// TODO add/merge/compare results of perf resource timing api
				
				cb(results);
			}

			for(; Scan.socketPool.length < Scan.poolCap && ips.length > 0; i++){
				createConnection(ips.shift());			
			}
		}, 50);

		/* create a single connection */
		function createConnection(ip){
			var startTime = Timer.getTimestamp();
			var ws = new WebSocket("ws://"+ ip);
			var wsResult = false;

			ws.onopen = function(evt){
				onresult(ip, "up", Timer.getTimestamp() - startTime);
			};

			ws.onclose = function(/*CloseEvent*/ evt){
				if(evt.code === 4999 && evt.reason === "NetScan"){
					onresult(ip, "up", Timer.getTimestamp() - startTime);
				}
				else {
					onresult(ip, "down", Timer.getTimestamp() - startTime);
				}
			};

			ws.onerror = function(evt){
				var timing = Timer.getTimestamp() - startTime;
				if(timing < Scan.timingLowerBound || timing > Scan.timingUpperBound){
					onresult(ip, "up", Timer.getTimestamp() - startTime);
				}
				else {
					onresult(ip, "down", Timer.getTimestamp() - startTime);
				}
			};

			/* trigger a manual close after some time, identified by "code" and "reason"
			 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes */1
			var timeout = setTimeout(function(){
				ws.close(4999, "NetScan");
			}, Scan.wsoTimeout);

			// TODO: evaluate if an additional timeout improves scan time, while not wasting result accuracy

			// TODO: handle blocking of http authentication (in FF)

			Scan.socketPool.push(ws);
		
			function onresult(ip, status, time){
				if(!wsResult){
					clearTimeout(timeout);
					wsResult = true;
					results.push({ip: ip, status: status, time: time});
					
					Scan.socketPool.splice(Scan.socketPool.indexOf(ws), 1);
					ws.close();
					ws = null;
				}
			}
		}
	};

	Scan.getHostsLocalNetwork = function(cb){
		Scan.getIps(function(ips){
			var toTest = {};
			var testCount = 0, 
				testedCount = 0;

			for(var i = 0; i < ips.length; i++){
				if(toTest[ips[i].ip] === undefined){
					toTest[ips[i].ip] = true;
					testCount++;
				}
			}

			var all = [];
			for(var ip in toTest){
				var tip = Util.ipToArray(ip);
				tip[3] = "0-255";
				tip = tip.join(".");
				Scan.getHostsWS(tip, function(res){
					all = all.concat(res);
					testedCount++;
					if(testedCount === testCount){
						cb(all);
					}
				});
			}
		});
	};

	Scan.getPortStatus = function(host, port, cb){};

	Scan.getPorts = function(host, portrange, cb){};

	T.Scan = Scan;

	/**********************************/




	return T;
}());
