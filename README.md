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

// TODO how does it work, technique, methods, architecture
// TODO differences/advantages over existing projects

Limitations
-----------

// TODO

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

not integrated yet:
- [12]: https://webrtchacks.com/the-minimum-viable-sdp/
- [13]: https://github.com/fippo/minimal-webrtc
- [14]: https://github.com/WesselWessels/minisdp
- [15]: https://webrtchacks.com/anatomy-webrtc-sdp/
- [16]: http://tools.ietf.org/html/draft-nandakumar-rtcweb-sdp
- [17]: https://webrtchacks.com/sdp-anatomy/

- [18]: https://html.spec.whatwg.org/multipage/comms.html#network

- [19]: https://www.w3.org/TR/resource-timing/
- [20]: https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API

