Client side network scanning with JavaScript
============================================


Introduction
------------

The ongoing development and extensions to the JavaScript language opened up numerous new possibilities for web based applications
that heavily rely on data transfer over the network. In the beginning it was only possible to send HTTP requests through 
different means. Now also fast socket and peer-to-peer like connections with less overhead and higher troughput can be established.

All that can also be used to perform network discovery operations. 
Host scanning, port scanning, private and public IP detection are achievable.
This may lead to deanonymization or exploitation of local network devices like routers and printers which often employ very weak
or no security measures at all. CSRF, router reconfiguration, DNS manipulation and disclosure of sensitive data would be some examples.
Four different methods with varying potential regarding performance, scanning capabilities, result reliability and browser support.

*IMG probing* is the oldest technique. The name is not any standardized concept or JavaScript language feature. It is just a descriptive
term for this particular method. First a HTML DOM `img` element is created, then two event handler functions are registered for the 
`load` and `error` events and the `src` attribute is set to some non exsitent image URL on the host/port to test. In the last step 
a timer is started and the image element is inserted into the DOM, which will start a HTTP request which will try to retrieve the image.
In the event handlers another timer is set when one of the events fires. The time span of the timers can then be used and compared to
some predefined values in order to determine whether the server is online and the image could not be found or the server is offline.
Actually there are several other HTML elements which might be used for this purpose, but `img`-elements are the most common ones.
This technique is rather limited because it satisfies scanning if a host is alive or not to a certain extent. It can also be used 
for port scanning, but the results won't be very precise or reliable. More on the port scanning part with this method can be found in [4].

*XHR* short for *XMLHttpRequest* stands for the JavaScript object with the same name which is used to issue various types of HTTP requests [5].
This method is similar to previous one, but does not need to interact with the DOM. Again this method depends on timing checks which are made
when the `readystate` property of the *XMLHttpRequest* object changes. Depending on how long the request takes a conclusion about the host or 
port can be drawn. The result of the actual request is irrelevant, as the same-origin-policy will interfere with most of them [6] [7].

*Websocket* is a protocol for client server socket like communication. It allows a much more fine grained distinction when scanning for 
active hosts in a network than the former methods. In addition it is also faster, because timing values can be lowered as a result of the low 
protocol overhead. Also more connection error messages are available. Timing in combination with checking setup and error messages can be used 
for host and port analysis. The same-origin-policy is also less problematic because it has to be checked by the remote server to which the 
connection is made and can be denied, but the browser does not restrict such a connection attempt [3] [11].

*WebRTC* [9] [10] which stands for "Web Real Time Communication" is a very new API and still not completely implemented in almost all browsers [8].
It enables peer-to-peer data transfer in the browser and features some NAT traversal capabilities for maximum connectivity.
Programmatically it requires much more code and is rather complex in contrast to the previous methods. However the advantage are the 
possibilites it opens for network discovery. It can gather live hosts in the local network of a browser as well as private and public ip 
addresses of the client. Furthermore it can be used to fingerprint Chromium-based browsers by collecting their "Device-ID". 
Such a fingerprint is resistant to ISP or IP changes, browser and system restarts and browser cookie or cache wipes by third party addons. [1] [2] [3] 


Related work
------------

In this section the most prominent projects related to client side network scanning with JavaScript are discussed.
They are grouped in categories according to the technological methods they are using.
The category "Mixed" contains projects that combine multiple techniques.
To the best of my knowledge no programs that only use *Websockets* exist.
Those that are mainly based on *Websockets* always contain some kind of fallback mechanism, when this type of socket is not available.

### Mixed:
- http://www.andlabs.org/tools/jsrecon/jsrecon.html (at least since 2011, exact date unknown)
  JSRecon is only guaranteed to work on Windows machines and although it is designed to scan internal networks only, it is possible to scan
  arbitrary external networks after some small changes in the source code. The scanning is done by using *XHR* and *Websockets*.
  The timing of the internal states and state changes of those JavaScript objects is measured and compared to predefined values.
  That allows the detection of the status of the remote end (open, closed, etc.).
- https://github.com/beefproject/beef/wiki/Network-Discovery 
  BeEF includes several modules for network exploration: 
  - One which gets the internal lan ip by using *WebRTC* or a *Java applet*. (since 2013)
  - Lan subnet identification and host checking (ping sweep) by timed *XHR* or a *Java applet*. (since 2015/2011)
  - Host checking (like above with timed *XHR*) while also considering DNS resolution ("DNS enumeration module"). (since 2011)
  - Port scanning which combines *XHR*, *Websockets* and *IMG probing* and timing all three methods. (since 2011)
  - identifying routers and different server software by loading commonly used resources with *IMG probing*. Modules "internal network fingerprinting", "js lanscanner" and "get http servers". (since 2011/2015/2015)
- http://algorithm.dk/lanscan (2015)
  This is a very modern implementation using *WebRTC* and *Websockets* based on the blogpost at [1].
  The tool ("lanscan") is able to scan the local network. In the initial step *WebRTC* is used to find the clients local ip.
  Afterwards a *Websocket* connection is opened to scan for possible hosts using the internal socket state to determine the final status.
  Although on the blog it is stated that several things are planned and an article explaining the concept will appear soon, this project
  has not been updated for a longer time.
- https://thehackerblog.com/sonar-a-framework-for-scanning-and-exploiting-internal-hosts-with-a-webpage/ (2015)
  "sonar.js" is designed as a framework for local network and especially router exploitation.
  The network discovery methods of the "lanscan" tool are used for this purpose. 
  After the hosts that are alive are recorded, an identification process starts. 
  It tries to load resources like images and stylesheets which are present in the web administration panels of routers.
  A predefined database where those common resource files are defined is included, although it is smaller than those used by the BeEF project.
  It also seems that this project has been abandoned, because the last updates are several months old.
- https://github.com/joevennix/lan-js (2015)
  "lan-js" is made for identifying/fingerprinting routers.
  The author(s) took the code for identifying the local ip from BeEF as can be seen in ip\_discovery.js
  *Websockets* or *IMG loading* (depending on which is available) is used to find active hosts in the local network.
  *IMG loading* is also used for fingerprinting afterwards. Code for detecting css stylesheet fingerprints is also included, but their
  database contains only image fingerprints.
- https://dunnesec.com/2013/09/16/html5-webrtc-local-ip-discovery/ (2013)
  First the local ip is detected by this JavaScript. Based on this result the local network is scanned for active hosts.
  The simple *IMG loading* is used for this. The author states that it works on all popular desktop operating systems (Win, OSX, Linux) with Firefox
  and that it does not work in Chrome on Linux. In my test in Firefox on Linux it reported many false positives. 
  In Windows it did work better, however still not 100% accurate.

### IMG Probing:
The approach to create a HTML "img" element and set the "src" attribute to load an arbitrary URL through HTTP GET requests and measure the time
it takes to get a response and record possible errors is the oldest technique to determine if a host exists. This can also be used to scan
ports. The disadvantage is that only limited cases can be distinguished and the rate of false negatives can be high. For example when
the remote hosts waits for some input and hangs the host might be classified as dead although it is not.
Most of the JavaScript "network scanner" follow this technique and very old versions can be found.
Some try to optimize the performance by batch processing, but at its core the code is always very similar.
Additional information is only given when they did something special.
- https://defuse.ca/in-browser-port-scanning.htm (2015)
- https://github.com/allodoxaphobia/JenScan (2012)
- http://jsscan.sourceforge.net/ (2009)
- http://www.gnucitizen.org/blog/javascript-port-scanner/ (2006, does not exist anymore, source can be found at http://www.securiteam.com/exploits/5DP010KJFE.html)
- https://www.myria.de/lan-scan/index.php (2007)
  This scanners primary goal is to find and identify routers in the network through well known images.
  It contains a database of several image entries.


### WebRTC:
- https://github.com/diafygi/webrtc-ips (2015)
  This script just prints the local and public ip of the client using *WebRTC*

### XHR:
- https://github.com/skepticfx/scanner.skepticfx.com (2013)
The authors Ahamed Nafeez M. and Anjana G. are stating that they are using: 

> Pure + Awesome Websockets & Cross-Origin Resource Sharing features of the browser to scan internal network hosts and IP Addresses.

Actually they are only using *XmlHttpRequests* to probe combinations of ip and port together with timing to determine if a host is alive. 




Approach
--------
This section describes all details of the library, what it is capable of and how the 
different techniques work.

### Browser support
The library was tested in the following browsers:
- Chromium (Version 51.0.2704.79 Built on 8.4, running on Debian 8.5 (64-bit)
- Iceweasel 38.8.0 Debian 8.5 (64-bit) (Firefox)

A few differences exist, because of the varying support of current specifications of the 
web platform. 
- The fetch API is fully supported in Firefox >= 40. In the tests in Iceweasel 
  38.8.0 it did not provide information in opaque requests. See: http://caniuse.com/#feat=fetch
- The version of Chromium did only expose partial information in the performance timing API.
  This will be very likely fixed in future versions, see: [21].
  
In general the library should be fully functional in any browser which fully supports the 
fetch API, performance timing API, WebRTC, Websockets, Promises and Arrow Functions.

### Library Structure

The library will export the symbol "NetScan" and make its methods globally available. It is 
divided into 3 sub-modules. The modules "Timer" and "Util" contain functions for time 
measurement and parsing and data structure preparation respectively. The module "Scan" 
provides all functions for network scanning, the core of the library. Those will be 
summarized as follows:

- `getHostIps` detects which local and which public ip addresses are associated with the 
  local machine.

- The `createConnection*`-functions (`createConnectionXHR, createConnectionWS, createConnectionFetch, createConnectionHTML`) 
  are designed to establish a connection to a specific address and gather information. The 
  suffix indicates which technology/API will be used to do this.

- The `getHosts*`-functions (`getHostsXHR, getHostsWS, getHostsFetch, getHostsHTML`) will 
  scan a range of ip addresses and perform host discovery. They will merge information 
  obtained from different data sources and aggregate all results in an array of 
  `ScanResult`-objects.

- `getHostsLocalNetwork` automatically scans all hosts in the current local network. One of 
  the `getHosts*`-functions can be provided to change the scan method.

- `getPorts` can be used to scan various ports of a single host. One of the `createConnection*`-functions 
  can be used to change the technology which will be used. Due to browser restrictions some 
  ports cannot be scanned, those will be reported as "BLOCKED". 

### Supported Functionality
For all scan types, four different technologies can be used: The fetch API, Websockets, 
XMLHttpRequests or HTTP requests through HTML elements. They all differ in the amount of 
information they expose as well as performance (how fast can a certain number of hosts be 
scanned). 

The fetch API is usually the best technology, as observed in the tests. It can scan 
a large number of hosts in a relatively small amount of time and also supports something 
called "opaque" requests. Those can be used to determine if a remote host understands the 
HTTP protocol even if it does not send CORS headers. The only downside is that a very new 
browser version is required and several browsers still do not support this new API.

XMLHttpRequests also have a good performance. Like "fetch"-requests the browser does not 
impose very restricitve limitations on the amount of requests which can be dispatched 
concurrently.

Websockets perform significantly worse. Browsers have certain hard limits on the number of 
simultaneously created Websockets. Firefox caps this number at 200. The number of sockets 
which are active at the same time has to be controlled and limited by the library. This 
increases the scan time.

The last variant of establishing a connection by creating a HTML element is the slowest. 
Simultaneous requests are severly limited. Scans using this method can take a very long time.
In addition no internal state changes can be accessed, thus less detailed information 
gathered.

#### Host scan
Host discovery is based mainly on timing information. The time it takes between starting a 
request and the arrival of its response, or when its timeout is triggered, is measured. 
When a host exists at a certain ip address, they will most likely either respond very fast 
(within a few hundred milliseconds) or take a very long time, because they keep the tcp 
connection open or simply do not respond. When a host does not exist at a specific address 
the browser will abort the connection after about 3000 milliseconds. When observing the 
network traffic one can see that multiple ARP requests are made. After not receiving a 
response for 3 seconds the browser will give up. In the library per default connections which 
take between 2900 milliseconds and 10000 milliseconds are considered that ther is no active 
remote host. All others are initially considered as up.

The results obtained from the timing information are refined by data from internal state 
changes of the JavaScript objects or possible results of the requests, if such information 
is available. This depends on the used scan technique. Also any available network error 
information of the connections and the JavaScript objects is used.

Furthermore information of the performance timing API [19] [20] is used. This API should provide 
detailed timing information for website developers. For security reasons only start, end and 
duration times will be exposed when the origin of a requested resource violates the 
same-origin policy. During tests while developing NetScan.js it was observed, that as soon as 
some data is received when establishing a connection to some remote address, a duration time 
will be recorded. This allows us to determine if a remote host has some service running at 
a certain address or not.

#### Port scan
Port scanning works similar to host scanning, but the parameters for timing and how the 
status is determined are different. Additionally blocked ports need to be considered. 
In general blocked ports cannot be tested, only the FTP ports 21 and 22 are an exception, 
where a HTML scan is applicable. Timing data is also less informative, because only 2 cases 
are distinguishable: Either the port is closed, or open and responds with some data and 
closes the TCP connection fast. In the other case the connection is kept open and hangs, 
most of the time until the connection is closed by us or because of some implementation 
dependent timeout. Further cases can only be differentiated when additional information is 
available (fetch, performance timing API). The details can be found documented in the source 
code.

### Advantages over existing projects
To the best of my knowledge all other existing libraries only use very little information. 
Most of the time they only use timing data. None of them uses the modern fetch API which has 
several advantages. NetScan.js can determine host and port states with a much higher accuracy 
because it accesses and combines multiple sources of information. The timing model does not 
only decide the status based on a single threshhold and can be easily configured individually 
for each scan method.

Limitations
-----------

Browsers only expose high level functionality to interact with the network and remote machines.
This results in general in a larger number of false positives or false negatives, because of
the inability to inspect or send specially crafted network packets (like popular network 
scanners like nmap do [37]), which would allow a much more fine grained categorization and 
identification. The traffic that can be generated is also limited to TCP. Although WebRTC 
would be able to send UDP packets, this can not be used for our scanning purposes.

Further additional restrictions apply to different APIs and protocols, like 
*Cross-Origin-Resource-Sharing (CORS)* [6] [7] [35], *Content Security Policies (CSP)* [36] and 
blocking of specific ports for different protocols [30] [31] [32] [34]. CORS and CSP 
can be evaded by relying on side channel information, metadata and correlate data from 
different JavaScript APIs with request data. Even though we can not access response 
information directly we can derive certain information about a response with that technique.
Unfortunately the **port blocking cannot be bypassed**. The only possibility which exists, is 
using a protocol which allows a required port to be accessed. While there exist some more 
protocols than the common http and https ones, most others are only for viewing internal 
browser (debugging) data and can not be used for network requests. A single exception exists, 
the ftp protocol. It allows connections to ports 21 and 22. The downside is that the ftp 
scheme only works in combination with HTML based requests, which have a lower performance 
and result accuracy and information than the other scan types. In the future browsers might 
also remove their ftp capabilities, because of the small usage numbers [33].


Further tests
-------------
This section describes experiments which were conducted during the development of NetScan.js, 
but did not yield the expected or useful results. Some of the tests are still included in 
the "test" subfolder.

It was tried to extract connection information and timing data from WebRTC in order to 
use it for network scans. Although there exist many points where internal state data can be 
accessed it did not prove as useful. A meaningful conclusion cannot be drawn, as there are 
not much differences in the internal processing between existing and non-existing hosts. 
In a second attempt various manipulations on the SDP which is used in WebRTC [16] were 
tested. The goal was to establish arbitrary connections to any ip address chosen by us. 
I was able to achieve to send packets to addresses chosen manually, but I did not manage 
to get manually crafted data through, as no ICE connection was established. This could 
need further exploration, because WebRTC and the internal mechanisms are rather complex and 
include a lot of different specifications and RFCs. Some useful information on SDP can be 
found at [12] [13] [13] [14] [15] [17].

Another experiment was dedicated to reading cross-origin content. Based on previous research 
[38] [39] and using recent web API specifications [40] [41], I tried finding similar timing 
side channel attacks in various combinations of SVG features (especially filters), cross 
origin resources, WebGL and various other JavaScript methods. Unfortunately nothing of 
significance was found.

In combination with the fetch API, also a new feature called "Service Workers" [42] [43] [44] 
was inspected. They were designed to make a website also work offline and being able to make 
better use of the browser cache. Service Workers allow precise control over which resources 
are cached and which resources will get served when a request is made. It is also possible 
to intercept requests and manipulate them on the fly. So I tried if any advantage can be 
gained when fiddling around with requests and responses. After investigating the browser 
source code I learned that data which is caches by Service Workers is transformed multiple 
times based on their attributes. The only problem is that most properties of the JavaScript 
Request/Response-objects are read only. Although they can be overwritten by some JavaScript 
hacks, the changes could not be propagated to the browsers internal objects. Most likely this 
was because of some sandboxing mechanisms. Still there are further possibilities which 
could be tried to extract some cross origin information. 

References
----------
- [1]: http://www.golgi.io/excuse-me-sir-your-webrtc-is-leaking/
- [2]: https://www.browserleaks.com/webrtc#webrtc-device-id
- [3]: http://www.linux-magazin.de/Ausgaben/2013/12/Web-RTC-Hack
- [4]: https://defuse.ca/in-browser-port-scanning.htm
- [5]: https://xhr.spec.whatwg.org/
- [6]: https://www.w3.org/Security/wiki/Same_Origin_Policy
- [7]: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
- [8]: http://iswebrtcreadyyet.com/
- [9]: https://www.w3.org/TR/webrtc/
- [10]: https://webrtc.org/
- [11]: https://tools.ietf.org/html/rfc6455

- [12]: https://webrtchacks.com/the-minimum-viable-sdp/
- [13]: https://github.com/fippo/minimal-webrtc
- [14]: https://github.com/WesselWessels/minisdp
- [15]: https://webrtchacks.com/anatomy-webrtc-sdp/
- [16]: http://tools.ietf.org/html/draft-nandakumar-rtcweb-sdp
- [17]: https://webrtchacks.com/sdp-anatomy/

- [18]: https://html.spec.whatwg.org/multipage/comms.html#network

- [19]: https://www.w3.org/TR/resource-timing/
- [20]: https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API
- [21]: https://bugs.chromium.org/p/chromium/issues/detail?id=460879#c11

- [22]: https://fetch.spec.whatwg.org/
- [23]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

- [24]: https://xhr.spec.whatwg.org/
- [25]: https://www.w3.org/TR/XMLHttpRequest2/
- [26]: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest

- [27]: https://tools.ietf.org/html/rfc6455
- [28]: https://www.w3.org/TR/2011/WD-websockets-20110929/
- [29]: https://developer.mozilla.org/de/docs/Web/API/WebSocket

- [30]: https://fetch.spec.whatwg.org/#port-blocking
- [31]: https://cs.chromium.org/chromium/src/net/base/port_util.cc?q=kRestrictedPorts&sq=package:chromium&dr=CSs&l=22
- [32]: https://developer.mozilla.org/en-US/docs/Mozilla/Mozilla_Port_Blocking
- [33]: https://bugs.chromium.org/p/chromium/issues/detail?id=333943
- [34]: https://dxr.mozilla.org/mozilla-central/search?q=%2Boverrides%3A%22nsIProtocolHandler%3A%3AAllowPort%28int32_t%2C+const+char+*%2C+bool+*%29%22

- [35]: https://www.w3.org/TR/cors/
- [36]: https://www.w3.org/TR/CSP2/

- [37]: https://nmap.org/book/man-port-scanning-techniques.html

- [38]: R. Kotche, Y. Pei and P. Jumde, "Stealing cross-origin pixels: Timing attacks on CSS filters and shaders" 2013. \[Online\]. Available: http://www.robertkotcher.com/pdf/TimingAttacks.pdf
- [39]: P. Stone, "Pixel Perfect Timing Attacks with HTML5" 2013. \[Online\]. Available: http://www.contextis.com/documents/2/Browser_Timing_Attacks.pdf
- [40]: https://www.w3.org/TR/html51/webappapis.html#animation-frames
- [41]: https://svgwg.org/svg2-draft/

- [42]: http://www.html5rocks.com/en/tutorials/service-worker/introduction/
- [43]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- [44]: https://www.w3.org/TR/service-workers/