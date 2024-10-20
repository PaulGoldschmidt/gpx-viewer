/**
* @author axelkeller
* 
* JS Functions for GPXViewer
*/
var gpx_file = null;
var gpx_content = null;

/**
 * Toggle reduce buttons
 */
var factor = 2;
function gpxv_toggle() {
	var clean	 = document.getElementById('forceCleaning').checked;
	if (clean) {
		switch (factor) {
			case 1:	document.getElementById('slight').checked = true;
					break;
			case 2:	document.getElementById('medium').checked = true;
					break;
			case 3:	document.getElementById('strong').checked = true;
					break;
		}
		document.getElementById('slight').disabled = 
		document.getElementById('medium').disabled =
		document.getElementById('strong').disabled = false;
	}
	else {
		var slight	 = document.getElementById('slight').checked;
		var medium	 = document.getElementById('medium').checked;
		var strong	 = document.getElementById('strong').checked;
		factor	 = slight? 1 : (medium? 2 : (strong? 3 : 2));
		document.getElementById('slight').checked = 
		document.getElementById('medium').checked = 
		document.getElementById('strong').checked = false;
		document.getElementById('slight').disabled =
		document.getElementById('medium').disabled =
		document.getElementById('strong').disabled = true;
	}
}

/**
 * If cleaning options are set the gpx file is cleaned.
 * If the url is set the gpx file is uploaded to the Server with AJAX,
 * otherwise it is displayed only.
 * @param	input		file descriptor
 * @param	category	category of gpx file
 * @param	url			of server for upload. If not given gpx content is displayed
 * @param	minXyDeriv	minimum lateral derivation
 * @param	minElDeriv	minimum elevation derivation
 * @param	maxSpikeRatio	maximum ratio for elevation spike; derivation / length
 */
function gpxv_upload_file(input, category, url, minXyDeriv, minElDeriv, maxSpikeRatio) {
	// check if file type is '.gpx'
	if (input.files.length >= 1) {
		gpx_file = input.files[0];
		if (gpx_file.name.search(/.\.gpx$/i) < 0) {
			document.getElementById('gpxv-error').value = gpx_file.name + ": </strong>" + gpxv_translations.invalid_xml;
			document.getElementById('gpxv-upload').submit();
			return;
		}
	}
	else {
		document.getElementById('gpxv-error').value = gpxv_translations.no_file;
		document.getElementById('gpxv-upload').submit();
		return;
	}

	var msgs = document.getElementsByClassName('settings-error');
	for (var i = msgs.length - 1; i >= 0; i--)
		msgs[i].parentNode.removeChild(msgs[i]);

	// get cleaning options
	var label	 = document.getElementById('label').value;
	var clean	 = document.getElementById('forceCleaning').checked;
	var slight	 = document.getElementById('slight').checked;
	var medium	 = document.getElementById('medium').checked;
	var strong	 = document.getElementById('strong').checked;
	var factor	 = slight? 1 : (medium? 2 : (strong? 3 : 2));
	var replace  = document.getElementById('replaceElevation').checked;
	var progress = document.getElementById("gpxv-progress");

	if (clean || replace)
		progress.innerHTML = gpxv_translations.cleaning;

	// read original gpx file into GPXCleaner asynchronously
	gpxc.loadFile(gpx_file, continueUpload);

	// continues here with function 'continueUpload' after reading original gpx file
	// (this is necessary because file reading runs asynchronously)
	function continueUpload(loaded_text) {
		gpx_content = loaded_text;
		if (gpxc._track) {
			if (clean) {
				gpxc.smoothElevationData(factor, maxSpikeRatio);	// smooth elevation data
				gpxc.reducePoints(minXyDeriv, minElDeriv);			// reduce track points
			}
			if (replace) {
				var status = gpxc.replaceElevationData();		// replace elevation data
				switch (status) {
					case 0:		break;
					case 600:	document.getElementById('gpxv-error').value = gpxv_translations.no_data;
								document.getElementById('gpxv-upload').submit();
								return;
					default:	document.getElementById('gpxv-error').value = gpxv_translations.http_error + " " + status;
								document.getElementById('gpxv-upload').submit();
								return;
				}
				if (clean)
					gpxc.smoothElevationData(factor, maxSpikeRatio);	// smooth elevation data
			}
			gpx_content = gpxc.newTrack(label, clean, replace);
		}

		if (!gpxc._track)
			document.getElementById('gpxv-error').value = gpxv_translations.no_track + " ";
		
		if (url) {
			// upload gpx_content to the server
			progress.innerHTML = gpxv_translations.uploading;
			var data = new FormData();
			data.append('action', 'gpxv_file_upload');
			data.append('category', category);
			data.append('filename', gpx_file.name);
			data.append('gpx', gpx_content);
			if (gpxc._track && (clean))
				data.append('clean', 'true');
			input.files = null;						// don't touch the selected gpx file 

			var http = new XMLHttpRequest();
			http.open("POST", url, true);
			http.onload = function () {				// continues here when uploaded
				if (http.response.charAt(0) == 's')
					document.getElementById('gpxv-success').value = http.response.substr(1);
				if (http.response.charAt(0) == 'e')
					document.getElementById('gpxv-error').value += http.response.substr(1);
				document.getElementById('gpxv-upload').submit();
			};
			http.send(data);
		}
		else {
			gpxm.gpxdata.src = gpx_content;
			gpxm.profile_displayed = false;
			gpxm.mapdata.autocenter = true;
			gpxm.map = gpxm.Map(true);
		}
	}
}

/**
 * Update edited track sending gpx file to the server
 * 
 * The edited polyline points have to be completed with elevation data and time data 
 * from the original gpx file.
 * @param	file_url	file_url of uploaded gpx file
 * @param	category	category of uploaded gpx file
 * @param	url			of server for upload
 */
function gpxv_update_edited_track(file_url, category, url) {
	var progress = document.getElementById("gpxv-progress2");
	progress.innerHTML = gpxv_translations.updating;

	// load original gpx file
	var http = new XMLHttpRequest();
	http.open('POST', file_url, true);		// POST: avoid loading from cache
	try {
		http.overrideMimeType('text/xml');	// unsupported by IE
	} catch(e) {}
	http.onload = function() {
			continueUpdate(http.response);
	};
	http.send(null);

	// continues here with function 'continueUpdate' after reading uploaded gpx file
	// (this is necessary because file reading runs asynchronously)
	function continueUpdate(response) {
		if (!gpxc.parseFile(response)) {
			document.getElementById('gpxv-error').value = file_url + ": </strong>" + gpxv_translations.invalid_xml;
			document.getElementById('gpxv-upload').submit();
			return;
		}

		gpxc.completeTrack();
		if (gpxc._track.length == 0) {
			document.getElementById('gpxv-error').value = gpxv_translations.no_tracks + " ";
			document.getElementById('gpxv-upload').submit();
			return;
		}

		var gpx = gpxc.newTrack('', false, false);
		// upload gpx file to the server
		var data = new FormData();
		data.append('action', 'gpxv_file_upload');
		data.append('category', category);
		data.append('filename', file_url.substr(file_url.lastIndexOf('/') + 1));
		data.append('gpx', gpx);
		data.append('update', 'true');

		var http = new XMLHttpRequest();
		http.open("POST", url, true);
		http.onload = function () {				// continues here when uploaded
			if (http.response.charAt(0) == 's')
				document.getElementById('gpxv-success').value = http.response.substr(1);
			if (http.response.charAt(0) == 'e')
				document.getElementById('gpxv-error').value += http.response.substr(1);
			document.getElementById('gpxv-upload').submit();
		};
		http.send(data);
	}
}

/**
 * Load gpx file to the client
 *	If cleaning option is set the gpx file is cleaned before.
 * @param	input		file descriptor
 * @param	category	category of gpx file
 * @param	url			of server for upload
 * @param	minXyDeriv	minimum lateral derivation
 * @param	minElDeriv	minimum elevation derivation
 * @param	maxSpikeRatio	maximum ratio for elevation spike; derivation / length
 */

function gpxv_open_file(input, minXyDeriv, minElDeriv, maxSpikeRatio) {
	// check if file type is '.gpx'
	if (input.files.length >= 1) {
		gpx_file = input.files[0];
		if (gpx_file.name.search(/.\.gpx$/i) < 0) {
			document.getElementById('gpxv-error').value = gpx_file.name + ": </strong>" + gpxv_translations.invalid_xml;
			document.getElementById('gpxv-load').submit();
			return;
		}
	}
	else {
		document.getElementById('gpxv-error').value = gpxv_translations.no_file;
		document.getElementById('gpxv-load').submit();
		return;
	}
	
	// clear current map
	var parent	= document.getElementById("map-container");
	var hook	= document.getElementById("leaflet-map");
	var child	= document.getElementById("track");
	parent.removeChild(hook);
	hook		= document.createElement("div");
	var att		= document.createAttribute('id');
	att.value	= 'leaflet-map';
	hook.setAttributeNode(att);
	parent.insertBefore(hook, child);
	
	document.getElementById('gpxv-message').style.display='none';
	
	// get title from filename
	if (document.getElementById("gpx-title") != null) 
		document.getElementById("gpx-title").textContent
				= gpx_file.name.substr(0, gpx_file.name.lastIndexOf('.gpx'));

	// clean gpx track and display it
	gpxv_upload_file(input, '', '', minXyDeriv,	minElDeriv, maxSpikeRatio);

	document.getElementById("gpxv-progress").innerHTML = '';
	document.getElementById("track").hidden = false;
	document.getElementById("storebutton").hidden = false;
	gpxFileSelected = true;
}

var gpxFileSelected = false;

/**
 * Store edited track
 * 
 * The edited polyline points have to be completed with elevation data and time data
 * from the loaded and modified gpx file that is still in gpxc._track and gpxc._wpts.
 * @param	file_url	file_url of uploaded gpx file
 */
function gpxv_store_edited_track() {
	if (gpxFileSelected) {
		gpxc.completeTrack();
		if (gpxc._track.length == 0) {
			document.getElementById('gpxv-error').value = gpxv_translations.empty_track + " ";
			document.getElementById('gpxv-load').submit();
			return;
		}
	}
	// store edited track via browser dialog
	var label = document.getElementById('label').value;
	var gpx = gpxc.newTrack(label, false, false);
	var filename = gpxv_translations.new_filename+'.gpx';
	if (gpx_file)
		filename = gpx_file.name;
	var file = new File([gpx], filename, {type: "application/octet-stream"});
	var blobUrl = (URL || webkitURL).createObjectURL(file);
	window.location = blobUrl;		
}
