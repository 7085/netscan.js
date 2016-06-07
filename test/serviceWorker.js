var urlsToIntercept = [
	"https://w0y.at/pages/about.html",
	"https://www.w3.org/TR/resource-timing/"
];

this.addEventListener("install", function (event) {
	console.log("installing");
	// event.waitUntil(
	// 	caches.open("test").then(function (cache) {
	// 		return cache.addAll([
	// 			"asdf.html"
	// 		]);
	// 	})
	// );
});

this.addEventListener("activate", function (event) {
	/* purge all caches */
	event.waitUntil(
		caches.keys().then(function (cacheNames) {
			return Promise.all(
				cacheNames.map(function (cacheName) {
					console.log("purging cache: ", cacheName);
					return caches.delete(cacheName);
				})
			);
		})
	);
});

this.addEventListener("fetch", function (event) {
	if(urlsToIntercept.indexOf(event.request.url) === -1){
		return;
	}
	
	console.log("Handling fetch event for", event.request.url);
	
	/* overwrite read only property */
	Object.defineProperty(Response.prototype, "type", {
		value: "basic",
		writable: false
	});
	Object.defineProperty(Response.prototype, "type", {
		get: function () { return "basic"; }
	});
	Object.defineProperty(Response.prototype, "status", {
		value: 203,
		writable: false
	});
	Object.defineProperty(Response.prototype, "status", {
		get: function () { return 203; }
	});
	Object.defineProperty(Response.prototype, "ok", {
		value: true,
		writable: false
	});
	Object.defineProperty(Response.prototype, "ok", {
		get: function () { return true; }
	});
	Object.defineProperty(Response.prototype, "statusText", {
		value: "Non-Authoritative Information",
		writable: false
	});
	Object.defineProperty(Response.prototype, "statusText", {
		get: function () { return "Non-Authoritative Information"; }
	});
					
	event.respondWith(
		caches.match(event.request.url)
		.then((response) => {
			console.log("cached response", response.clone());
			return response.clone();
		})
		.catch(() => {
			var f = fetch(event.request.url, {method: "GET", mode: "no-cors"}) //{method: "GET", mode: "no-cors", cache: "no-store"}
			.then(function (response) {
				console.log("fetched response", response.clone());
				
				/* forge response */
				response.clone().blob().then(buffer => {
					var h = new Headers();
					h.append("Access-Control-Allow-Origin", "*");
					h.append("x-forged", "true");
					var r = new Response(buffer, {"status": 200, "statusText": "OK", headers: h});

					console.log("forged: ", r.clone());

					/* cache it */
					caches.open(event.request.url)
						.then(function (cache) {
							console.log("caching response...");
							cache.put(event.request.url, r.clone());
						});

					//return response.clone();
					//return r;
				});
				
			})
			.catch(function (error) {
				console.error("fetch failed", error);
			});
			
			return f;
		})
	);
});

this.addEventListener("message", function(event){
	console.log("Got message:", event);
	var defer = caches.open(event.data.url)
	.then(cache => {
		// console.log("cache:", cache);
		// cache.keys().then(keys => {console.log("Keys", keys);});
		
		cache.match(event.data.url)
		.then(entry => {
			/* if not found resolves to undefined */
			if(entry === undefined){
				event.ports[0].postMessage({error: "entry not found"});
			}
			else {
				console.log("entry:", entry);
				
				var resp = entry;
				resp.text().then(body => {
					//console.log("body", body);
					var b = body;
					var s = ""+ resp.status +" :: "+ resp.statusText;
					var h = "";
					for (var header of resp.headers.entries()) {
						h += header[0] +": "+ header[1] +"\n";
					}
					console.log(performance.getEntriesByType("resource"));
					/* 	we cannot pass the response through, domexception will be thrown,
						need to serialize it before */
					event.ports[0].postMessage({status: s, headers: h, body: b});
				});
			}
			
		})
	})
	.catch(err => {
		event.ports[0].postMessage({error: "cache not found"});
	});
	
	/* 	
		This ensures that all tasks get executed,
		otherwise there is a possibility that the
		service worker gets stopped before everything
		is done
	 */
	if("waitUntil" in event){
		event.waitUntil(defer);
	}
});