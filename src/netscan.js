
(function () {
	"use strict";

	console.log("setting up browser compatibility");
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



	/* globals / instance vars, might be exposed for debugging */
	var connLocal,
		connRemote,
		serverConfig,
		peerConfig,
		recvChan,
		sendChan;


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
	Timer.getTimestamp = function(){
		return window.performance.now();
	};

	
	/* SDP candidate line structure (a=candidate:)
	 * 0 			1 					UDP 				2122252543 		192.168.2.108 		52229 		typ host
	 * candidate | rtp (1)/rtcp (2) | protocol (udp/tcp) | priority 	| ip				| port		| type (host/srflx/relay)
	 */
	
	function extractConnectionInfo(candidate){
		var matches = /.+? ((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/.exec(candidate);

		if(matches === null || matches.length !== 3){
			return null;
		}

		return {ip: matches[1], port: matches[2]};
	}

	function replaceConnectionInfo(candidate, replacement){
		return candidate.replace(/.+? ((?:\d{1,3}\.){3}\d{1,3}) (\d{1,5}) typ host/,
			function(m, p1, p2){
				var t = m.replace(p1, replacement.ip);
				t = t.replace(p2, replacement.port);
				return t;
			});
	}



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

	function handleCandidateRemote(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate remote: ", candidate.candidate);
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			var host = extractConnectionInfo(candidate.candidate);
			if(host !== null){
				console.log("trying to manipulate ip", host);
				host.ip = "192.168.2.109";
				candidate.candidate = replaceConnectionInfo(candidate.candidate, host);
				console.log("ip should now be different", candidate);
			}
			/* have to add candidate to local conn */
			connLocal.addIceCandidate(candidate, iceCandidateSuccess, iceCandidateError);
			console.log("sdp updated (local): ", connLocal.localDescription.sdp);
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}

	function handleCandidateLocal(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate local: ", candidate.candidate);
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			connRemote.addIceCandidate(evt.candidate, iceCandidateSuccess, iceCandidateError);
			console.log("sdp updated (remote): ", connRemote.localDescription.sdp);
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}

	function DBG(e){
		//console.log(JSON.stringify(e));
		console.log(e);
	};

	function test(){
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

		connLocal.onicecandidate = handleCandidateLocal;

		connLocal.oniceconnectionstatechange = iceConnectionStateChange;
		connLocal.onsignalingstatechange = signalingStateChange;
		connLocal.onconnectionstatechange = DBG;
		connLocal.onicecandidateerror = DBG;
		connLocal.onicegatheringstatechange = DBG;


		connRemote = new RTCPeerConnection(serverConfig, peerConfig);
		connRemote.onicecandidate = handleCandidateRemote;

		connRemote.oniceconnectionstatechange = iceConnectionStateChange;
		connRemote.onsignalingstatechange = signalingStateChange;
		connRemote.onconnectionstatechange = DBG;
		connRemote.onicecandidateerror = DBG;
		connRemote.onicegatheringstatechange = DBG;

		connRemote.ondatachannel = function(event){
			console.log("Received data channel");
			recvChan = event.channel;
			//recvChan.binaryType = "arraybuffer";
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
		

		var offerDesc;
		connLocal.createOffer(function(sessionDescription){
			// TODO measure time
			offerDesc = sessionDescription;
			console.log("creating offer:", offerDesc.sdp);
			//console.log(offerDesc);

			connLocal.setLocalDescription(offerDesc);
			connRemote.setRemoteDescription(offerDesc);

			var answerDesc;
			connRemote.createAnswer(function(sessionDescription2){
				// TODO measure time
				answerDesc = sessionDescription2;
				console.log("creating answer:", answerDesc.sdp);
				//console.log(answerDesc);


				// TODO manipulate remoteDescription


				connRemote.setLocalDescription(answerDesc);
				connLocal.setRemoteDescription(answerDesc);

			},
			function(error){
				console.log("Could not create answer: ", error);
			});

		},
		function(error){
			console.log("Could not create offer: ", error);
		}); //, constraints



		//connLocal.addIceCandidate(new RTCIceCandidate({candidate:"candidate:0 1 UDP 2122252543 10.0.0.138 57192 typ host", sdpMLineIndex:0, sdpMid:""}), DBG, DBG);

	}

	test();
}());
