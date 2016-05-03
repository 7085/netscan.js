
(function () {
	"use strict";

	console.log("test");
	// compatibility: see https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection
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


	function handleCandidate(evt){
		console.log("got candidate event");
		if(evt.candidate){
			var candidate = evt.candidate;
			//console.log(JSON.stringify(candidate));
			console.log(candidate);
		}
		else { /* at this state (evt.candidate == null) we are finished */
			// TODO
			console.log("finished", JSON.stringify(evt));
		}
	}

	function DBG(e){
		//console.log(JSON.stringify(e));
		console.log(e);
	};

	function test(){
		console.log("starting test");

		var config = {
			iceServers: [
				{urls: ["stun:stun.l.google.com:19302"]} // "stun:stun.l.google.com:19302"
			], 
			iceTransportPolicy: "all",
			bundlePolicy: "balanced",
			rtcpMuxPolicy: "negotiate" // default: "require"
		};
		var conn = new RTCPeerConnection(config, {});
		conn.onicecandidate = handleCandidate;

		conn.oniceconnectionstatechange = DBG;
		conn.onidentityresult = DBG;
		conn.onidpassertionerror = DBG;
		conn.onidpvalidationerror = DBG;
		conn.onnegotiationneeded = DBG;
		conn.onpeeridentity = DBG;
		conn.onremovestream = DBG;
		conn.onsignalingstatechange = DBG;
		

		var dataChannel = conn.createDataChannel("dataChan");
		dataChannel.onopen = function (event) {
		  console.log("datachannel open");
		};
		dataChannel.onclose = function (event) {
		  console.log("datachannel close");
		};
		dataChannel.onmessage = function (event) {
		  console.log("received: " + event.data);
		};
		dataChannel.onerror = function (event) {
		  console.log("datachannel close");
		};


		conn.createOffer(function(sessionDescription){
			// TODO measure time
			console.log("creating offer:", JSON.stringify(sessionDescription));
			conn.setLocalDescription(sessionDescription);
			// TODO check if we can manually set/manipulate remoteDescription

		},
		function(error){
			console.log("Could not create offer: ", error);
		}); //, constraints

		conn.addIceCandidate(new RTCIceCandidate({candidate:"candidate:0 1 UDP 2122252543 10.0.0.138 57192 typ host", sdpMLineIndex:0, sdpMid:""}), DBG, DBG);

	}

	test();
}());
