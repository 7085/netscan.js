/**
 * Data object used for scan results.
 */
export default class ScanResult {
	constructor(address, duration, status, info) {
		this.address = address;
		this.duration = duration;
		this.status = status;
		this.info = info;
	}

	toString () {
		return "ScanResult for '" + this.address + "', duration: " + this.duration.toFixed(2) + ", status: " + this.status + ", info: " + this.info;
	}

	toTableString () {
		return "<tr><td>" + this.address + "</td><td>" + this.status + "</td><td>" + this.duration.toFixed(2) + "</td><td>" + this.info + "</td></tr>";
	}
}