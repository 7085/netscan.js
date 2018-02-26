netscan.js - Network Scanner for Browser Environments
=====================================================


Introduction
------------
Network scanning on the client side in JavaScript is possible in a limited way through various techniques.
Since we are restricted by high level HTTP requests, several security measures by browsers and cannot use low level networking stuff like Sockets we almost never can determine the network status of a remote device or port by the response data.
However by combining side channel information this can be overcome.
Four different methods with varying potential regarding performance, scanning capabilities, result reliability and browser support exist:

*DOM element requests* are the oldest technique. 
Here a certain DOM element that can retrieve a remote resource is created.
After the relevant attribute that links to the resource is set a HTTP request is issued by the browser.
Most commonly `img` elements or their JavaScript equivalent `Image` object are used here, but others are also available.
Through registering event handler functions for the `load` and `error` events, timing information can be obtained.

*XHR* short for *XMLHttpRequest* stands for the JavaScript object with the same name.
Its purpose is to issue various types of HTTP requests [2].
Again this method depends on timing checks which are made when the `readystate` property of the *XMLHttpRequest* object changes. 
Depending on how long the request takes a conclusion about the host or port can be drawn. 

*WebSocket*s are a protocol for client-server, socket like communication avoiding the overhead of consecutive HTTP requests. 
When trying to establish such a connection initially a HTTP request will be dispatched, which can be used for our scanning purposes [7].

*WebRTC* [5] [6] which stands for "Web Real Time Communication" is a very new API and still subject to changes in many browsers.
It enables peer-to-peer data transfer in the browser and features some NAT traversal capabilities for maximum connectivity.
Programmatically it requires much more code and is rather complex in contrast to the previous methods.
It is not suitable to perform a request to a specific host or port.
However it is perfectly suited for reliably determining private and public ip addresses of the client (browser). 

*fetch* is the newer API for HTTP requests in JavaScript.
It can be seen as a direct alternative or replacement for XHR.
Not only the standard request timing information can be obtained.
It also allows some interesting request configurations which leak additional data that can be further used.


Approach
--------
This section describes all details of the "NetScan.js"-library, what it is capable of and how the 
different techniques work.

### Browser support
The library was tested in the following browsers:
- Chromium (Version 51.0.2704.79)
- Chromium (Version 64.0.3282.167)
- Iceweasel 38.8.0 Debian 8.5 (64-bit)
- Firefox 45.2.0 Debian 8.5 (64-bit)
- Firefox 58.0.2 (64-Bit)

Currently it works as expected in Firefox only. 
In Chrome only the HTML requests behave similar like in Firefox.
The other methods for HTTP-requests don't produce usable results.
They also have different timings.
Furthermore Chromium only exposes partial information in the performance timing API.
See: [16].

### Library Structure

The library will export the symbol `NetScan` as a global variable.
Through this one the `Scan` and `Timer` modules are available for usage.
The module `Scan` provides all functions for network scanning, the core of the library.
The module `Timer` can be used as for convenience like in the test examples.

- `getHostIps` detects which local and which public ip addresses are associated with the local machine.

- The `createConnection*`-functions (`createConnectionXHR, createConnectionWS, createConnectionFetch, createConnectionHTML`) are designed to establish a connection to a specific address and gather information. 
  The symbol-suffix indicates which technology/API will be used to do this.

- The `getHosts*`-functions (`getHostsXHR, getHostsWS, getHostsFetch, getHostsHTML`) will scan a range of ip addresses and perform host discovery. 
  They will merge information obtained from different data sources and aggregate all results in an array of `ScanResult`-objects.

- `getHostsLocalNetwork` automatically scans all hosts in the current local network. 
  One of the previously named `getHosts*`-functions can be provided to change the default scan method which is `getHostsFetch`.

- `getPorts` can be used to scan various ports of a single host. 
  One of the `createConnection*`-functions can be used to change the technology which will be used for the scan. 
  Due to browser restrictions some ports cannot be scanned, those will be reported as "BLOCKED". 

### Supported Functionality
For all scan types, four different technologies can be used: The fetch API, Websockets, XMLHttpRequests or HTTP requests through HTML elements. 
They all differ in the amount of information they expose as well as performance (how fast can a certain number of hosts be scanned). 

The fetch API is usually the best technology, as observed in the tests. 
It can scan a large number of hosts in a relatively small amount of time and also supports something called "opaque" requests, which leak some useful additional information. 
Those can be used to determine if a remote host understands the HTTP protocol even if it does not send CORS headers. 
The only downside is that a very new browser version is required and several browsers still do not support this new API, but will in the near future.

XMLHttpRequests also have a good performance. Like "fetch"-requests the browser does not impose very restricitve limitations on the amount of requests which can be dispatched concurrently.

Websockets perform significantly worse. 
Browsers have certain hard limits on the number of simultaneously created Websockets. 
Firefox for example caps this number at 200. 
This varies accross browsers. 
The number of sockets which are active at the same time has to be controlled and limited by the library. 
This increases the scan time fundamentally.

The last variant of establishing a connection by creating a HTML element is the slowest. 
The amount of simultaneous requests is severly limited by browser implementations. 
Scans using this method can take a very long time. 
In addition no internal state changes can be accessed, thus less detailed information gathered.

#### Host scan
Host discovery is based mainly on timing information. 
The time it takes between starting a request and the arrival of its response, or when its timeout is triggered, is measured. 
When a host exists at a certain ip address, they will most likely either respond very fast (within a few hundred milliseconds) or take a very long time, because they keep the tcp connection open or simply do not respond. 
When a host does not exist at a specific address the browser will abort the connection after about 3000 milliseconds. 
When observing the network traffic one can see that multiple ARP requests are made. 
After not receiving a response for 3 seconds the browser will give up. 
In the library per default, connections which take between 2900 milliseconds and 10000 milliseconds are considered that there is no active remote host. 
All others are initially considered as up.

The results obtained from the timing information are refined by data from internal state changes of the JavaScript objects or possible results of the requests, if such information is available. 
This depends on the used scan technique. 
Also any available network error information of connections and the respective JavaScript objects that initiated them is used.

Furthermore information of the performance timing API [14] [15] is used. 
This API should provide detailed timing information for website developers.
For security reasons only start, end and duration times will be exposed when the origin of a requested resource violates the same-origin policy. 
During tests while developing NetScan.js it was observed, that as soon as some data is received when establishing a connection to some remote address, the entries are different from those where no data was received. 
By running some timing calculations and comparisons this allows us to determine if a remote host has some service running at a certain address or not.

#### Port scan
Port scanning works similar to host scanning, but the parameters for timing and how the status is determined are different. 
Additionally blocked ports need to be considered. 
In general blocked ports cannot be tested, only the FTP ports 21 and 22 are an exception, where a HTML scan is applicable. 
Timing data is also less informative, because only 2 cases are distinguishable: 
Either the port is closed, or open and responds with some data and closes the TCP connection fast. 
In the other case the connection is kept open and hangs, most of the time until the connection is closed by us or because of some implementation dependent timeout by the underlying networking layer of the browser. 
Further cases can only be differentiated when additional information is available by using fetch-based requests, and/or merging information of the performance timing API.

### Advantages over existing projects
To the best of my knowledge all other existing libraries only use very little information. 
Most of the time they only use timing data combined with a single threshold, thus determining the status based on a single comparison. 
None of them uses the modern fetch API which has several advantages. 
NetScan.js can determine network states with a much higher accuracy because it accesses and combines multiple sources of information. 
The timing model does not only decide the status based on a single threshold, but tries to gather as much information as possible and can be easily configured individually for each scan method.


Limitations
-----------
Browsers only expose high level functionality to interact with the network and remote machines.
This results in general in a larger number of false positives or false negatives, because of the inability to inspect or send specially crafted network packets (like popular network scanners like nmap do [23]), which would allow a much more fine grained categorization and identification. 
The traffic that can be generated is also limited to TCP. 
Although WebRTC would be able to send UDP packets, this can not be used for targeted scanning of specific hosts and ports.

The result of a request is irrelevant and cannot be accessed most of the time, as the same-origin-policy will interfere [3] [4] [22].
We can only rely on side channel information, metadata and correlating data from different JavaScript APIs with request data. 
This varies across browsers.

Certain ports are blocked for different protocols [17] [18] [19] [21]. 
The only possibility for a bypass is using a different protocol which allows a required port to be accessed. 
While there exist some more protocols than the common http and https ones, most others are only for viewing internal browser (debugging) data and can not be used for network requests. 
A single exception exists, the ftp protocol. 
It allows connections to ports 21 and 22. 
The downside is that the ftp scheme only works in combination with HTML based requests, which have a lower performance and result accuracy and information than the other scan types. 
In the future browsers might also remove their ftp capabilities, because of the small usage numbers [20].


Further tests
-------------
It was tried to extract connection information and timing data from WebRTC in order to use it for network scans. 
Although there exist many points where internal state data can be accessed it did not prove as useful. 
A meaningful conclusion cannot be drawn, as there are not much differences in the internal processing between existing and non-existing hosts. 
In a second attempt various manipulations in the session description protocol (SDP) which is used in WebRTC [12] were tested. 
The goal was to establish arbitrary connections to any ip address chosen by us and collect data directly, through errors or timing side channels subsequently. 
I was able to achieve to send packets to addresses chosen manually, but I did not manage to get manually crafted data through, as no ICE connection was established. This could need further exploration, because WebRTC and the internal mechanisms are rather complex and include a lot of different specifications and RFCs. 
Some useful information on SDP can be found at [8] [9] [9] [10] [11] [13].


Related work
------------
In this section some projects related to client side network scanning with JavaScript are discussed.

- http://www.andlabs.org/tools/jsrecon/jsrecon.html (at least since 2011, exact date unknown)
  JSRecon is only guaranteed to work on Windows machines and although it is designed to scan internal networks only, it is possible to scan
  arbitrary external networks after some small changes in the source code. 
  The scanning is done by using *XHR* and *WebSockets*.
  The timing of the internal states and state changes of those JavaScript objects is measured and compared to predefined values.
  That allows the detection of hosts and the status of remote ports (open, closed, etc.).
- https://github.com/beefproject/beef/wiki/Network-Discovery 
  BeEF includes several modules for network exploration: 
  - One which gets the internal lan ip by using *WebRTC* or a *Java applet*. (since 2013)
  - Lan subnet identification and host checking (ping sweep) by timed *XHR* or a *Java applet*. (since 2015/2011)
  - Host checking (like above with timed *XHR*) while also considering DNS resolution ("DNS enumeration module"). (since 2011)
  - Port scanning which combines *XHR*, *WebSockets* and *DOM element requests* and timing all three methods. (since 2011)
  - identifying routers and different server software by loading commonly used resources with *DOM element requests*. Modules "internal network fingerprinting", "js lanscanner" and "get http servers". (since 2011/2015/2015)
- http://algorithm.dk/lanscan (2015)
  This is a very modern implementation using *WebRTC* and *WebSockets* based on the blogpost at [1].
  The tool ("lanscan") is able to scan the local network. In the initial step *WebRTC* is used to find the clients local ip.
  Afterwards a *WebSocket* connection is opened to scan for possible hosts using the internal socket state to determine the final status.
  Although on the blog it is stated that several things are planned and an article explaining the concept will appear soon, this project
  has not been updated for a longer time. A very short timeout is used to speed up scan times, but sacrificing result accuracy.
- https://thehackerblog.com/sonar-a-framework-for-scanning-and-exploiting-internal-hosts-with-a-webpage/ (2015)
  "sonar.js" was designed as a framework for local network and especially router exploitation.
  The exact same network discovery methods of the "lanscan" tool are used for this purpose. 
  After the hosts that are alive are recorded, an identification process starts. 
  It tries to load resources like images and stylesheets which are present in the web administration panels of routers.
  A predefined database where those common resource files are defined is included. 
  The fingerprint database is much smaller than those used by the BeEF project.
  It also seems that this project has been abandoned, because the last updates are several months old.
- https://github.com/joevennix/lan-js (2015)
  "lan-js" is made for identifying/fingerprinting routers.
  The author(s) took the code for identifying the local ip from BeEF as can be seen in ip\_discovery.js
  *WebSockets* or *IMG loading* (depending on which is available) is used to find active hosts in the local network.
  *IMG loading* is also used for fingerprinting afterwards. 
  Code for detecting css stylesheet fingerprints is also included, but their
  database contains only image fingerprints.
- https://dunnesec.com/2013/09/16/html5-webrtc-local-ip-discovery/ (2013)
  First the local ip is detected by this JavaScript. 
  Based on this result the local network is scanned for active hosts.
  The simple *IMG loading* is used for this. 
  The author states that it works on all popular desktop operating systems (Win, OSX, Linux) with Firefox and that it does not work in Chrome on Linux.
- https://defuse.ca/in-browser-port-scanning.htm (2015) 
  Uses DOM element requests.
- https://github.com/allodoxaphobia/JenScan (2012)
  Uses DOM element requests.
- http://jsscan.sourceforge.net/ (2009)
  Uses DOM element requests.
- http://www.gnucitizen.org/blog/javascript-port-scanner/ (2006)
  Does not exist anymore, source can be found at http://www.securiteam.com/exploits/5DP010KJFE.html)
- https://www.myria.de/lan-scan/index.php (2007)
  This scanners primary goal is to find and identify routers in the network through well known images.
  It contains a database of several image entries.
- https://github.com/skepticfx/scanner.skepticfx.com (2013)
  The authors Ahamed Nafeez M. and Anjana G. are stating that they are using: 
  > Pure + Awesome Websockets & Cross-Origin Resource Sharing features of the browser to scan internal network hosts and IP Addresses.
  Actually they are only using *XHR* to probe combinations of ip and port together with timing to determine if a host is alive. 



[1]: http://www.golgi.io/excuse-me-sir-your-webrtc-is-leaking/
[2]: https://xhr.spec.whatwg.org/
[3]: https://www.w3.org/Security/wiki/Same_Origin_Policy
[4]: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
[5]: https://www.w3.org/TR/webrtc/
[6]: https://webrtc.org/
[7]: https://tools.ietf.org/html/rfc6455
[8]: https://webrtchacks.com/the-minimum-viable-sdp/
[9]: https://github.com/fippo/minimal-webrtc
[10]: https://github.com/WesselWessels/minisdp
[11]: https://webrtchacks.com/anatomy-webrtc-sdp/
[12]: http://tools.ietf.org/html/draft-nandakumar-rtcweb-sdp
[13]: https://webrtchacks.com/sdp-anatomy/
[14]: https://www.w3.org/TR/resource-timing/
[15]: https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API
[16]: https://bugs.chromium.org/p/chromium/issues/detail?id=460879#c11
[17]: https://fetch.spec.whatwg.org/#port-blocking
[18]: https://cs.chromium.org/chromium/src/net/base/port_util.cc?q=kRestrictedPorts&sq=package:chromium&dr=CSs&l=22
[19]: https://developer.mozilla.org/en-US/docs/Mozilla/Mozilla_Port_Blocking
[20]: https://bugs.chromium.org/p/chromium/issues/detail?id=333943
[21]: https://dxr.mozilla.org/mozilla-central/search?q=%2Boverrides%3A%22nsIProtocolHandler%3A%3AAllowPort%28int32_t%2C+const+char+*%2C+bool+*%29%22
[22]: https://www.w3.org/TR/cors/
[23]: https://nmap.org/book/man-port-scanning-techniques.html
