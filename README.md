Client side network scanning with Javascript
============================================

Related work
------------

// TODO explain *WebRTC*, *Websockets*, *XHR*, *IMG loading*

### mixed:
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
  - Port scanning which combines *XHR*, *Websockets* and *IMG loading* and timing all three methods. (since 2011)
  - identifying routers and different server software by loading commonly used resources with *IMG loading*. Modules "internal network fingerprinting", "js lanscanner" and "get http servers". (since 2011/2015/2015)
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

### img probing:
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


### webrtc:
- https://dunnesec.com/2013/09/16/html5-webrtc-local-ip-discovery/ (2013)
  First the local ip is detected by this JavaScript. Based on this result the local network is scanned for active hosts.
  Only *WebRTC* is used for this. The author states that it works on all popular desktop operating systems (Win, OSX, Linux) with Firefox.
  It does not work in Chrome on Linux. In my test in Firefox on Linux it reported many false positives. In Windows it did work more accurately,
  but still not 100% accurate.
- https://github.com/diafygi/webrtc-ips (2015)
  This script just prints the local and public ip of the client using *WebRTC*

### xhr:
- https://github.com/skepticfx/scanner.skepticfx.com (2013)
The authors Ahamed Nafeez M. and Anjana G. are stating that they are using: 
> Pure + Awesome Websockets & Cross-Origin Resource Sharing features of the browser to scan internal network hosts and IP Addresses.
Actually they are only using *XmlHttpRequest*s to probe combinations of ip and port together with timing to determine if a host is alive. 

### interesting reads:
- [1] http://www.golgi.io/excuse-me-sir-your-webrtc-is-leaking/
- [2] https://www.browserleaks.com/webrtc#webrtc-device-id
- [3] http://www.linux-magazin.de/Ausgaben/2013/12/Web-RTC-Hack


Limitations
-----------


