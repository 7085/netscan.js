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
	console.log("Handling fetch event for", event.request.url);

	event.respondWith(
		caches.match(event.request.url)
		.then((response) => {
			console.log("cached response", response.clone());
			return response;
		})
		.catch(() => {
			return fetch(event.request.url, {method: "GET", mode: "no-cors", cache: "no-store"})
			.then(function (response) {
				console.log("fetched response", response.clone());
				
				/* cache it */
				caches.open(event.request.url)
				.then(function(cache) {
					console.log("caching response...");
					cache.put(event.request.url, response.clone());
				});
				
				return response.clone();
			})
			.catch(function (error) {
				console.error("fetch failed", error);
			});
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
				console.log("entry:", entry.clone());
				
				var resp = entry.clone();
				resp.text().then(body => {
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