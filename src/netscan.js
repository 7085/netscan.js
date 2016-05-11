
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

	Timer.getTimestamp = function(){
		return window.performance.now();
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
	
	T.Util = Util;


	/**********************************/

	function Scan(){};

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
			if(evt.candidate){
				var candidate = evt.candidate;
				console.log("Got candidate:", candidate.candidate);

				var host = Util.extractConnectionInfo(candidate.candidate);
				if(host !== null){
					ips.push(host);
				}
			}
			else { /* at this state (evt.candidate == null) we are finished */
				Timer.stop("getIps");
				cb(ips);
				sendChan.close();
				conn.close();
				sendChan = null;
				conn = null;
			}
		};

		conn.createOffer()
			.then(function(offerDesc){
				//console.log("Creating offer:", offerDesc.sdp);
				conn.setLocalDescription(offerDesc);
			},
			function(error){/* dont care */});

	};

	Scan.getHostsLocalNetwork = function(cb){};

	Scan.getHostsReachable = function(cb){};

	Scan.getPorts = function(host, cb){};

	T.Scan = Scan;

	/**********************************/


	/* globals / instance vars, might be exposed for debugging */
	var connLocal,
		connRemote,
		serverConfig,
		peerConfig,
		recvChan,
		sendChan;

	function iceCandidateSuccess(){
		console.log("Successfully added ice candidate");
	}

	function iceCandidateError(err){
		console.log("Failed adding ice candidate", err);
	}

	function signalingStateChange(evt){
		console.log("signaling state: ", evt.target.signalingState);
	}

	function iceConnectionStateChange(evt){
		console.log("ice connection state: ", evt.target.iceConnectionState);
	}

	function sessionDescriptionSuccess(){
		console.log("Successfully set session description.");
	}

	function sessionDescriptionError(err){
		console.log("Failed to set session description: " + err.toString());
	}

	function DBG(e){
		//console.log(JSON.stringify(e));
		console.log(e);
	};


	function handleRemoteCandidate(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate remote: ", candidate.candidate);
			console.log(candidate);

			var host = Util.extractConnectionInfo(candidate.candidate);
			if(host !== null){
				console.log("trying to manipulate ip", host);
				host.ip = "192.168.2.108";
				candidate.candidate = Util.replaceConnectionInfo(candidate.candidate, host);
				console.log("ip should now be different", candidate);
			}
			/* have to add candidate to local conn */
			connLocal.addIceCandidate(candidate)
				.then(iceCandidateSuccess, iceCandidateError)
				.then(() => console.log("sdp updated (local): ", connLocal.remoteDescription.sdp));
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}

	function handleLocalCandidate(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate local: ", candidate.candidate);
			console.log(candidate);

			var host = Util.extractConnectionInfo(candidate.candidate);
			if(host !== null){
				console.log("trying to manipulate ip", host);
				host.ip = "192.168.2.106";
				candidate.candidate = Util.replaceConnectionInfo(candidate.candidate, host);
				console.log("ip should now be different", candidate);
			}

			connRemote.addIceCandidate(candidate)
				.then(iceCandidateSuccess, iceCandidateError)
				.then(() => console.log("sdp updated (remote): ", connRemote.remoteDescription.sdp));
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}


	T.test = function (){
		console.log("starting test");

		serverConfig = {
			iceServers: [
				{urls: ["stun:stun.l.google.com:19302"]} // "stun:stun.l.google.com:19302"
			], 
			iceTransportPolicy: "all",
			bundlePolicy: "balanced",
			rtcpMuxPolicy: "negotiate" // default: "require"
		};
		//serverConfig = null; // XXX
		peerConfig = null;
		
		connLocal = new RTCPeerConnection(serverConfig, peerConfig);

		sendChan = connLocal.createDataChannel("dataChannel", null);
		sendChan.onopen = function (event) {
			console.log("sendChan open");
			sendChan.send("test send msg");
		};
		sendChan.onclose = function (event) {
			console.log("sendChan close");
		};
		sendChan.onmessage = function (event) {
			console.log("sendChan received: " + event.data);
		};
		sendChan.onerror = function (err) {
			console.log("sendChan error: ", err);
		};

		connLocal.onicecandidate = handleLocalCandidate;

		connLocal.oniceconnectionstatechange = iceConnectionStateChange;
		connLocal.onsignalingstatechange = signalingStateChange;
		connLocal.onconnectionstatechange = DBG;
		connLocal.onicecandidateerror = DBG;
		connLocal.onicegatheringstatechange = DBG;


		connRemote = new RTCPeerConnection(serverConfig, peerConfig);
		connRemote.onicecandidate = handleRemoteCandidate;

		connRemote.oniceconnectionstatechange = iceConnectionStateChange;
		connRemote.onsignalingstatechange = signalingStateChange;
		connRemote.onconnectionstatechange = DBG;
		connRemote.onicecandidateerror = DBG;
		connRemote.onicegatheringstatechange = DBG;

		connRemote.ondatachannel = function(event){
			console.log("Received data channel");
			recvChan = event.channel;
			recvChan.onopen = function (event) {
				console.log("recvChan open");
			};
			recvChan.onclose = function (event) {
				console.log("recvChan close");
			};
			recvChan.onmessage = function (event) {
				console.log("recvChan received: " + event.data);
			};
			recvChan.onerror = function (err) {
				console.log("recvChan error: ", err);
			};
		};
		

		connLocal.createOffer()
			.then(function(offerDesc){
				// TODO measure time
				console.log("creating offer:", offerDesc.sdp);

				console.log("setting descriptions...");
				connLocal.setLocalDescription(offerDesc)
					.then(sessionDescriptionSuccess, sessionDescriptionError)
					.then(() => connRemote.setRemoteDescription(offerDesc))
					.then(sessionDescriptionSuccess, sessionDescriptionError)
					.then(() => console.log("descriptions are now: ", connLocal.localDescription.sdp, connRemote.remoteDescription.sdp))

					.then(() => connRemote.createAnswer())
					.then(function(answerDesc){
						// TODO measure time
						console.log("creating answer:", answerDesc.sdp);

						console.log("setting descriptions...");
						connRemote.setLocalDescription(answerDesc)
							.then(sessionDescriptionSuccess, sessionDescriptionError)
							.then(() => connLocal.setRemoteDescription(answerDesc))
							.then(sessionDescriptionSuccess, sessionDescriptionError)
							.then(() => console.log("descriptions are now: ", connLocal.remoteDescription.sdp, connRemote.localDescription.sdp));
			
					},
					function(error){
						console.log("Could not create answer: ", error);
					});

			},
			function(error){
				console.log("Could not create offer: ", error);
			});



		//connLocal.addIceCandidate(new RTCIceCandidate({candidate:"candidate:0 1 UDP 2122252543 10.0.0.138 57192 typ host", sdpMLineIndex:0, sdpMid:""}), DBG, DBG);

	}


	return T;
}());
