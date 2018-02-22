/**
 * Timer contains utility functions for time measurement.
 */
export default class Timer {

	static start(name) {
		window.performance.mark("start_" + name);
	}

	static stop(name) {
		window.performance.mark("stop_" + name);
	}

	static duration(name) {
		window.performance.measure("dur_" + name, "start_" + name, "stop_" + name);
		return performance.getEntriesByName("dur_" + name, "measure")[0].duration; // in ms
	}

	static durationInSec(name) {
		return (this.duration(name) / 1000).toFixed(3);
	}

	static durationDiff(startName, stopName) {
		window.performance.measure("dur_" + startName + stopName, "start_" + startName, "stop_" + stopName);
		return performance.getEntriesByName("dur_" + startName + stopName, "measure")[0].duration; // in ms
	}

	static durationDiffInSec(startName, stopName) {
		return (this.durationDiff(startName, stopName) / 1000).toFixed(3);
	}

	static getTimestamp() {
		return window.performance.now(); // in ms, micro-seconds fraction
	}

}