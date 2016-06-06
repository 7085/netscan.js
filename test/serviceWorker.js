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

	event.respondWith(
		caches.match(event.request.url)
		.then((response) => {
			console.log("cached response", response);
			return response;
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
					/* overwrite read only property */
					Object.defineProperty(r, "type", {
						value: "basic",
						writable: false
					});
					console.log("forged: ", r);

					/* cache it */
					caches.open(event.request.url)
						.then(function (cache) {
							console.log("caching response...");
							cache.put(event.request.url, r);
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
					console.log("body", body);
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