
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
	var conn,
		conn2,
		serverConfig,
		peerConfig,
		recvChan,
		sendChan;


	function iceCandidateSuccess(){
		console.log("Successfully added ice candidate");
	};

	function iceCandidateError(err){
		console.log("Failed adding ice candidate", err);
	};


	function handleCandidate(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate: ", candidate.candidate);
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			conn.addIceCandidate(evt.candidate, iceCandidateSuccess, iceCandidateError);
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}

	function handleCandidate2(evt){
		if(evt.candidate){
			var candidate = evt.candidate;
			console.log("got candidate2: ", candidate.candidate);
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			conn2.addIceCandidate(evt.candidate, iceCandidateSuccess, iceCandidateError);
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
		serverConfig = null; // XXX
		peerConfig = null;
		
		window.conn = conn = new RTCPeerConnection(serverConfig, peerConfig);

		sendChan = conn.createDataChannel("dataChannel", null);
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

		conn.onicecandidate = handleCandidate2;
/*
		conn.oniceconnectionstatechange = DBG;
		conn.onidentityresult = DBG;
		conn.onidpassertionerror = DBG;
		conn.onidpvalidationerror = DBG;
		conn.onnegotiationneeded = DBG;
		conn.onpeeridentity = DBG;
		conn.onremovestream = DBG;
		conn.onsignalingstatechange = DBG;
*/

		window.conn2 = conn2 = new RTCPeerConnection(serverConfig, peerConfig);
		conn2.onicecandidate = handleCandidate;
/*
		conn2.oniceconnectionstatechange = DBG;
		conn2.onidentityresult = DBG;
		conn2.onidpassertionerror = DBG;
		conn2.onidpvalidationerror = DBG;
		conn2.onnegotiationneeded = DBG;
		conn2.onpeeridentity = DBG;
		conn2.onremovestream = DBG;
		conn2.onsignalingstatechange = DBG;
*/
		conn2.ondatachannel = function(event){
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
		

// TODO check if we can manually set/manipulate remoteDescription

		var offerDesc;
		conn.createOffer(function(sessionDescription){
			// TODO measure time
			offerDesc = sessionDescription;
			console.log("creating offer:", offerDesc.sdp);
			console.log(offerDesc);

			conn.setLocalDescription(offerDesc);
			conn2.setRemoteDescription(offerDesc);

			var answerDesc;
			conn2.createAnswer(function(sessionDescription2){
				// TODO measure time
				answerDesc = sessionDescription2;
				console.log("creating answer:", answerDesc.sdp);
				console.log(answerDesc);

				conn2.setLocalDescription(answerDesc);
				conn.setRemoteDescription(answerDesc);

			},
			function(error){
				console.log("Could not create answer: ", error);
			});

		},
		function(error){
			console.log("Could not create offer: ", error);
		}); //, constraints



		//conn.addIceCandidate(new RTCIceCandidate({candidate:"candidate:0 1 UDP 2122252543 10.0.0.138 57192 typ host", sdpMLineIndex:0, sdpMid:""}), DBG, DBG);

	}

	test();
}());
