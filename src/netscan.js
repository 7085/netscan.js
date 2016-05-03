
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
		config,
		recvChan,
		sendChan;



	function handleCandidate(evt){
		console.log("got candidate event");
		if(evt.candidate){
			var candidate = evt.candidate;
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			conn.addIceCandidate(candidate, DBG, DBG);
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO get end time
			console.log("finished", JSON.stringify(evt));
		}
	}

	function handleCandidate2(evt){
		console.log("got candidate2 event");
		if(evt.candidate){
			var candidate = evt.candidate;
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
			conn2.addIceCandidate(candidate, DBG, DBG);
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

		config = {
			iceServers: [
				{urls: ["stun:stun.l.google.com:19302"]} // "stun:stun.l.google.com:19302"
			], 
			iceTransportPolicy: "all",
			bundlePolicy: "balanced",
			rtcpMuxPolicy: "negotiate" // default: "require"
		};
		conn = new RTCPeerConnection(config, {});
		conn.onicecandidate = handleCandidate;

		conn.oniceconnectionstatechange = DBG;
		conn.onidentityresult = DBG;
		conn.onidpassertionerror = DBG;
		conn.onidpvalidationerror = DBG;
		conn.onnegotiationneeded = DBG;
		conn.onpeeridentity = DBG;
		conn.onremovestream = DBG;
		conn.onsignalingstatechange = DBG;


		conn2 = new RTCPeerConnection(config, {});
		conn2.onicecandidate = handleCandidate2;

		conn2.oniceconnectionstatechange = DBG;
		conn2.onidentityresult = DBG;
		conn2.onidpassertionerror = DBG;
		conn2.onidpvalidationerror = DBG;
		conn2.onnegotiationneeded = DBG;
		conn2.onpeeridentity = DBG;
		conn2.onremovestream = DBG;
		conn2.onsignalingstatechange = DBG;
		recvChan;
		conn2.ondatachannel = function(event){
			recvChan = event.channel;
			//recvChan.binaryType = "arraybuffer";
			recvChan.onopen = function (event) {
				console.log("datachannel open");
			};
			recvChan.onclose = function (event) {
				console.log("datachannel close");
			};
			recvChan.onmessage = function (event) {
				console.log("received: " + event.data);
			};
			recvChan.onerror = function (event) {
				console.log("datachannel close");
			};
		};
		

		sendChan = conn.createDataChannel("dataChan");
		sendChan.onopen = function (event) {
			console.log("datachannel open");
			sendChan.send("test send msg");
		};
		sendChan.onclose = function (event) {
			console.log("datachannel close");
		};
		sendChan.onmessage = function (event) {
			console.log("received: " + event.data);
		};
		sendChan.onerror = function (event) {
			console.log("datachannel close");
		};

// TODO check if we can manually set/manipulate remoteDescription

		var offerDesc;
		conn.createOffer(function(sessionDescription){
			// TODO measure time
			offerDesc = sessionDescription;
			console.log("creating offer:", JSON.stringify(sessionDescription));
			console.log(sessionDescription);
			conn.setLocalDescription(sessionDescription);

			conn2.setRemoteDescription(sessionDescription);

			var answerDesc;
			conn2.createAnswer(function(sessionDescription){
				// TODO measure time
				answerDesc = sessionDescription;
				console.log("creating answer:", JSON.stringify(sessionDescription));
				console.log(sessionDescription);

				conn2.setLocalDescription(sessionDescription);
				conn.setRemoteDescription(sessionDescription);

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
