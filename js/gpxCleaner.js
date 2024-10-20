/**
 *-----------------------------------------------------------------------------
 * gpxCleaner.js
 *
 * 		GPX Track Cleaner
 *			- reducing track points very close to each other (Douglas-Peucker Algorithm)
 *			- smoothing elevation data (from Peter Danninger, peter@danninger.eu)
 *			- replacing elevation data using Open-Elevation online service
 *
 *		part of WordPress plugin GPX Viewer
 *
 * @author	axelkeller
 *
 *-----------------------------------------------------------------------------
 * A new GPX file is produced from waypoints and tracks (no routes)
 * that contains only geo data like <lat>, <lon>, <ele> and <time>.
 *
 * Spikes of elevation data resp. missing values can be adjusted.
 * Additionally the elevation profile is smoothed using the adjacent points. 
 *
 * Tracking of elevations data with mobile devices often results in poor values.
 * On demand the elevation data can be replaced by SRTM-values (Shuttle Radar Topography Mission)
 * using the Open-Elevation Online Elevation Service.
 *-----------------------------------------------------------------------------
**/
var gpxc = gpxc || {};							// Namespace

//-----------------------------------------------------------------------------

gpxc._loadedText	= "";						// Content of original GPX file
gpxc._attributes	= "";						// Attributes of original GPX file
gpxc._wpt_extension	= "";						// Waypoint extension
gpxc._trk_extension	= "";						// Track extension
gpxc._xmlDOM		= null;						// GPX file transformed in a Document Object Model (DOM)

gpxc._wpts			= new Array();				// way points
gpxc._trkName		= "";						// <name>
gpxc._track			= null;						// parsed and cleaned track

gpxc._meterJeGradLat = 40075017 / 360;			// 111.319,49 m (fix)
gpxc._meterJeGradLon = function(lat) {			// depending on lat
	return (gpxc._meterJeGradLat * Math.cos (lat * Math.PI / 180));
}


/**
 *	Load GPX file from local computer and transform in a DOM-Object (gpxc._xmlDOM),
 *	if the XML structure of the file is o.k., then parse the DOM-Object and generate an javascript object (gpxc._track)
 *	
 *	@param	file		file descriptor
 *	@param	callback	callback function when asynchronous loading and parsing have been finished
 *	@return	true/false	if operation was successful
**/
gpxc.loadFile = function(file, callback) {
	var loadedText = "";									// for the loaded content
	
	var fileReader = new FileReader ();
	
	fileReader.onload = function(fileLoadedEvent) {			// when GPX file has been loaded
		loadedText = fileLoadedEvent.target.result;			// content of the GPX file
		
		if (gpxc.parseFile(loadedText))
			callback(loadedText);							// loading and parsing have been finished
	}
	fileReader.readAsText (file, "UTF-8");
	
	// No waiting here for end of asnchronous "fileReader.onload"
}
/**
 *	Parse GPX input and transform it to a DOM-Object (gpxc._xmlDOM),
 *	if the XML structure of the file is o.k., then parse the DOM-Object and generate an javascript object (gpxc._track)
 *	
 *	@param	loadedText	loaded text of the GPX file
 *	@return	true/false	if operation was successful
**/
gpxc.parseFile = function(loadedText) {
	gpxc._loadedText = loadedText;
	loadedText = loadedText.replace(/>\s+</g,"><");		// clean text
	
	gpxc._xmlDOM = null;								// DOM object (tree structure)
	
	if (typeof ActiveXObject != "undefined" && typeof GetObject != "undefined") {
		gpxc._xmlDOM = new ActiveXObject ("Microsoft.xmlDOM");
		xmlDOM.loadXML (loadedText);					// IExplore workaround
	}

	if (typeof DOMParser != "undefined")
		gpxc._xmlDOM = (new DOMParser ()).parseFromString(loadedText, "text/xml");

	if (typeof gpxc._xmlDOM == "object" && gpxc._xmlDOM != null)
		gpxc.parseGPX();								// parse loaded file
	else
		return false;
	
	// save and extend gpx attributes
	i = loadedText.indexOf('<gpx ');
	if (i >= 0) {
		j = loadedText.indexOf('>', i);
		if (j > i) {
			gpxc._attributes = loadedText.substr(i+5, j-i-5);
			
			var attributes = gpxc._attributes;
			i = attributes.indexOf('modifier="');
			if (i >= 0) {
				j = attributes.indexOf('"', i+10);
				if (j > i)
					gpxc._attributes = attributes.substr(0, i) + attributes.substr(j+1);
			}
			var addon = '; modified by GPX Track Cleaner from GPX Viewer plugin (WordPress) ';
			var attributes = gpxc._attributes;
			i = attributes.indexOf(addon);
			if (i < 0) {
				i = attributes.indexOf('creator="');
				if (i >= 0) {
					j = attributes.indexOf('"', i+9);
					if (j > i)
						gpxc._attributes =	attributes.substr(0, j) + addon + attributes.substr(j);
				}
			}
		}
	}

	// save waypoint extensions
	i = loadedText.indexOf('<wpt ');
	if (i >= 0) {
		j = loadedText.indexOf('</wpt>', i+5);
		if (j > i) {
			var wpt = loadedText.substr(i+5, j-i-5);
			i = wpt.indexOf('<extensions>');
			k = wpt.indexOf('<extensions>', i+12);
			if (i >= 0) {
				j = wpt.indexOf('</extensions>');
				if (j > 0) {
					while (k > 0 && k < j) {
						j = wpt.indexOf('</extensions>', j+12);
						k = wpt.indexOf('<extensions>', k+12);
					}
					gpxc._wpt_extension = wpt.substr(i+12, j-i-12);
				}
			}
		}
	}
	
	// save track extensions
	i = loadedText.indexOf('<trk>');
	if (i >= 0) {
		j = loadedText.indexOf('</trk>', i+5);
		if (j > i) {
			var trk = loadedText.substr(i+5, j-i-5);
			i = trk.indexOf('<extensions>');
			k = trk.indexOf('<extensions>', i+12);
			if (i >= 0) {
				j = trk.indexOf('</extensions>');
				if (j > 0) {
					while (k > 0 && k < j) {
						j = trk.indexOf('</extensions>', j+12);
						k = trk.indexOf('<extensions>', k+12);
					}
					gpxc._trk_extension = trk.substr(i+12, j-i-12);
				}
			}
		}
	}
	return true;
}

/**
 * Parse the loaded GPX file and build up data objects
**/
gpxc.parseGPX = function() {
	var lat;								// latitude: - 90° (Soth pole) ... + 90° (North pole)
	var lon;								// longitude:  -180° (West) ... +180° (East)
	var ele;								// Elevation [m]
	var time;								// Timp stamp
	gpxc._wpts		= new Array ();			// cleaned way points
	gpxc._trkName	= "";					// Track name
	gpxc._track		= null;					// cleaned tracks

	//
	// parse way points ---------------------------------------------------------
	//
	// all way points of the GPX file
	var wpts = gpxc._xmlDOM.documentElement.getElementsByTagName ("wpt");

	for (var w = 0; w < wpts.length; w++) {				// loop over all waypoints ...
		lat = parseFloat (wpts[w].getAttribute ("lat"));
		lon = parseFloat (wpts[w].getAttribute ("lon"));
		ele = "--";
		if (typeof (wpts[w].getElementsByTagName ("ele")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("ele")[0].firstChild != null) {
				ele = parseFloat (wpts[w].getElementsByTagName ("ele")[0].firstChild.data);
				ele = +ele.toFixed (1);
				if (isNaN (ele))
					ele = "--";
			}
		}
		var tim = "";
		if (typeof (wpts[w].getElementsByTagName ("time")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("time")[0].firstChild != null) {
				tim = wpts[w].getElementsByTagName ("time")[0].firstChild.data;
				tim = gpxc.cleanTxt(tim);
			}
		}
		var nam = "";
		if (typeof (wpts[w].getElementsByTagName ("name")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("name")[0].firstChild != null) {
				nam = wpts[w].getElementsByTagName ("name")[0].firstChild.data;
				nam = gpxc.cleanTxt(nam);
			}
		}
		var cmt = "";
		if (typeof (wpts[w].getElementsByTagName ("cmt")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("cmt")[0].firstChild != null) {
				cmt = wpts[w].getElementsByTagName ("cmt")[0].firstChild.data;
				cmt = gpxc.cleanTxt(cmt);
			}
		}
		var desc = "";
		if (typeof (wpts[w].getElementsByTagName ("desc")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("desc")[0].firstChild != null) {
				desc = wpts[w].getElementsByTagName ("desc")[0].firstChild.data;
				desc = gpxc.cleanTxt(desc);
			}
		}
		var sym = "";
		if (typeof (wpts[w].getElementsByTagName ("sym")[0]) == "object") {
			if (wpts[w].getElementsByTagName ("sym")[0].firstChild != null) {
				sym = wpts[w].getElementsByTagName ("sym")[0].firstChild.data;
				sym = gpxc.cleanTxt(sym);
			}
		}
		if (nam == "" && cmt != "")
			nam = cmt;
		if (nam == "" && desc != "")
			nam = desc;
		if (desc == cmt)
			desc = "";
		if (cmt == nam)
			cmt = "";
		if (isNaN (lat) || isNaN (lon) || nam == "")	// invalid way point is skipped
			continue;

		var wpt = new Array (8);	// way point: lat, lon, ele, name, cmt, desc, sym, time
		wpt[0] = lat;
		wpt[1] = lon;
		wpt[2] = ele;
		wpt[3] = tim;
		wpt[4] = nam;
		wpt[5] = cmt;
		wpt[6] = desc;
		wpt[7] = sym;
		gpxc._wpts[w] = wpt;
	}
	
	//
	// Parse first track -------------------------------------------------------------
	//
	
	// All tracks of the GPX file
	var trks = gpxc._xmlDOM.documentElement.getElementsByTagName ("trk");
	
	if (trks.length > 0) {
		var trk = trks[0];								// data object for the first track

		// determine track name from <name>
		var name = "";
		if (typeof (trk.getElementsByTagName ("name")[0]) == "object") {
			if (trks[0].getElementsByTagName ("name")[0].firstChild != null) {
				name = trk.getElementsByTagName ("name")[0].firstChild.data;
				name = gpxc.cleanTxt(name);
			}
		}
		gpxc._trkName = name;

		// Loop over track segments
		//
		var trkSegs = trk.getElementsByTagName ("trkseg");		// all track segments of the GPX file
		var trksegs = new Array();		
		for (var s = 0; s < trkSegs.length; s++) {

			// Loop over track points
			//
			var trkPts = trkSegs[s].getElementsByTagName ("trkpt");		// all track points of the GPX file
			var trkpts = new Array();		
			for (var p = 0; p < trkPts.length; p++) {
				lat = parseFloat (trkPts[p].getAttribute ("lat"));
				lon = parseFloat (trkPts[p].getAttribute ("lon"));
				ele = "--";
				if (typeof (trkPts[p].getElementsByTagName ("ele")[0]) == "object") {
					if (trkPts[p].getElementsByTagName ("ele")[0].firstChild != null) {
						ele = parseFloat (trkPts[p].getElementsByTagName ("ele")[0].firstChild.data);
						ele = +ele.toFixed (1);
						if (isNaN (ele))
							ele = "--";
					}
				}
				time = "";
				if (typeof (trkPts[p].getElementsByTagName ("time")[0]) == "object") {
					if (trkPts[p].getElementsByTagName ("time")[0].firstChild != null) {
						time = trkPts[p].getElementsByTagName ("time")[0].firstChild.data;
					}
				}
				if (isNaN(lat) || isNaN(lon))	// invalid track point is skipped
					continue;
				
				var trpt = new Array (4);		// track point: lat, lon, ele and time
				trpt[0] = parseFloat(lat);
				trpt[1] = parseFloat(lon);
				trpt[2] = parseFloat(ele);
				trpt[3] = time;
				trkpts[p] = trpt;
			}
			trksegs[s] = trkpts;
		}
		gpxc._track = trksegs;
	}
}

/**
 * remove or replace invalid characters from name, cmt, or desc
 * 
 * @param	t	string to clean
 * @return		cleaned string
**/
gpxc.cleanTxt = function(t) {
	var s = t;
	if (t.indexOf ("&") >= 0) {
		if (t.indexOf ("&amp;") >= 0)
			s = t.replace ("&amp;", "und");
		// evtl. ergänzen
		else if (t.indexOf ("&") >= 0)
			s = t.replace ("&", "und");
	}
	return (s);
}

/**
 * Smooth elevation profile 
 *
 * @param	smoothFactor		factor for strongness of smoothing
 * @param	maxSpikeRatio		max ratio for elevation spike; derivation / length
 *
 * @globals	gpxc._track
**/
gpxc.smoothElevationData = function(smoothFactor, maxSpikeRatio) {
	if (gpxc._track) {
		var trk = gpxc._track;
		var i, j, k, kh, dh1, dh2, dh, ratio, ratio1, f1, fa, fg, zs;
		var lng1, lng2, lng;						// length of (p[i-1] - pi), (pi - p[i+1]), (p[i-1] - p[i+1])
		var t1 = new Array ();						// for smoothed elevation data
		
		for (s = 0; s < trk.length; s++) {			// loop over segments
			var trkseg = trk[s];
			if (trkseg.length < 4)
				return;								// track too short
			
			kh = "";
			for (i = 0; i < trkseg.length; i++) {	// search first valid elevation value
				kh = trkseg[i][2];
				if (!isNaN (kh))
					break;
			}
			if (i == trkseg.length)					// no elevation values
				return;
			for (i = 0; i < trkseg.length; i++) {	// correct empty or invalid elevation values
				if (isNaN(trkseg[i][2]))  
					trkseg[i][2] = kh;
				else                      
					kh = trkseg[i][2];
			}
			//
			// Elevation profile: adjust spikes greater than maxSpikeRatio
			//
			for (i = 1; i < (trkseg.length-1); i++) {
				lng1 = gpxc.getLength ([trkseg[i-1][0], trkseg[i-1][1], trkseg[i][0], trkseg[i][1]]);
				lng2 = gpxc.getLength ([trkseg[i][0], trkseg[i][1], trkseg[i+1][0], trkseg[i+1][1]]);
				lng  = gpxc.getLength ([trkseg[i-1][0], trkseg[i-1][1], trkseg[i+1][0], trkseg[i+1][1]]);
				
				if (lng1 <= 0.01)
					lng1 = 0.01;
				if (lng2 <= 0.01)
					lng2 = 0.01;
				if (lng <= 0.01)
					lng = 0.01;
				dh1 = trkseg[i][2] - trkseg[i-1][2];
				dh2 = trkseg[i+1][2] - trkseg[i][2];
				ratio = Math.abs (dh1 - dh2) / lng;				// relative distance to the adjacent elevation values
				ratio1 = Math.abs (dh1) / lng1;					// derivation from the predecessing elevation value
				if (ratio > maxSpikeRatio && ratio1 > maxSpikeRatio) {
					dh = trkseg[i+1][2] - trkseg[i-1][2];		// correct spikes
					trkseg[i][2] = +(trkseg[i-1][2] + (dh * lng1 / (lng1 + lng2))).toFixed (1);
				}
			}

			//
			// Smooth elevation profile depending on the track length.
			// The actual point and the adjacent points possibly are weighted stronger.
			//
			k = Math.ceil((Math.sqrt(trkseg.length) / 6) - 1);	// number of points taken for smothing
			if (k < 1)  
				k = 1;											//     to the left and to the right depending from track length
			k = Math.ceil (k * smoothFactor);					// smoothing factor
			fa = k + 2;   										// Höherbewertung des aktuellen Punktes     (3 ... )
			f1 = +Math.sqrt (k).toFixed (1);					// Höherbewertung direkt benachbarter Punkte  (1.0 ... )
			for (i = 0; i < trkseg.length; i++) {
				zs = +(fa * trkseg[i][2]);						// aktueller Punkt, um "fa" stärker bewerten
				fg = fa;
				if (i >= 1) {
					zs += +(f1 * trkseg[i-1][2]);				// Punkt davor, um "f1" stärker bewerten
					fg += f1;
				}
				if (i < (trkseg.length-1)) {
					zs += +(f1 * trkseg[i+1][2]);				// Punkt danach, um "f1" stärker bewerten
					fg += f1;
				}
				for (j = 2; j <= k; ++j) {
					if ((i-j) >= 0) {
					zs += +(trkseg[i-j][2]);					// weitere Punkte davor
					++fg;
					}
					if ((i+j) < trkseg.length) {
						zs += +(trkseg[i+j][2]);				// weitere Punkte danach
						++fg;
					}
				}
				t1[i] = +(zs / fg).toFixed (1);
			}
			for (i = 0; i < trkseg.length; i++)
				trkseg[i][2] = t1[i];							// copy new elevation value

			trk[s] = trkseg;
		}
		gpxc._track = trk;
	}
}

/**
 * Reduce track points of the parsed track
 *
 * @param	minXyDeriv	minimum lateral derivation
 * @param	minElDeriv	minimum elevation derivation
 *
 * @globals	gpxc._track
**/
gpxc.reducePoints = function(minXyDeriv, minElDeriv) {
	if (gpxc._track) {
		var trk = gpxc._track;
		
		for (s = 0; s < trk.length; s++) {			// loop over segments
			var trkseg = trk[s];
			var reducedList = new Array(0);

			// shorten next track section with maximum air distance, continously
			var pnt1 = 0;
			var pnt2 = 1;
			while (pnt2 < trkseg.length) {
				// find point with maximum air distance
				var dmax = 0;
				for (var i = pnt2; i < trkseg.length; i++) {
					d = gpxc.getLength([trkseg[pnt1][0], trkseg[pnt1][1], trkseg[i][0], trkseg[i][1]]);
					if (d >= dmax) {
						dmax = d;
						pnt2 = i;
					}
				}
				var tmp = reducedList.concat(gpxc.DouglasPeucker(trkseg, pnt1, pnt2, minXyDeriv, minElDeriv));
				reducedList = tmp;
				pnt1 = pnt2;
				pnt2 = pnt1 + 1;
			}
			trk[s] = reducedList;
		}
		gpxc._track = trk;
	}
}

/**
 * Shorten trackpoints according to Douglas-Peucker algorithm
 *
 * @param	trkseg		track segment
 * @param	pnt1		start of track section
 * @param	pnt2		end of track section
 * @param	minXyDeriv	minimum lateral derivation
 * @param	minElDeriv	minimum elevation derivation
 * @return				shortened track section
**/

gpxc.DouglasPeucker = function(trkseg, pnt1, pnt2, minXyDeriv, minElDeriv) {
	var resultList = new Array(0);
	if (pnt1 == pnt2)
		return new Array(trkseg[pnt1]);
	if (pnt1 + 1 == pnt2)
		return new Array(trkseg[pnt1], trkseg[pnt2]);
	
	// find point with maximum lateral derivation between P1 and P2
	var dmax = 0;
	var pntm = pnt1 + 1;
	var x1 = gpxc.getLength([trkseg[pnt1][0], trkseg[pnt1][1], trkseg[pnt1][0], 0]);
	var y1 = gpxc.getLength([trkseg[pnt1][0], trkseg[pnt1][1], 0, trkseg[pnt1][1]]);
	var x2 = gpxc.getLength([trkseg[pnt2][0], trkseg[pnt2][1], trkseg[pnt2][0], 0]);
	var y2 = gpxc.getLength([trkseg[pnt2][0], trkseg[pnt2][1], 0, trkseg[pnt2][1]]);
	var xd = x2 - x1;
	var yd = y2 - y1;
	if (xd != 0 || yd != 0) {
		for (var i = pnt1 + 1; i < pnt2; i++) {
			// perpendicular distance d
			var x0 = gpxc.getLength([trkseg[i][0], trkseg[i][1], trkseg[i][0], 0]);
			var y0 = gpxc.getLength([trkseg[i][0], trkseg[i][1], 0, trkseg[i][1]]);
			var d = Math.abs(yd*x0 - xd*y0 + x2*y1 - y2*x1) / Math.sqrt(xd*xd + yd*yd);
			if (d > dmax) {
				pntm = i;
				dmax = d;
			}
		}
	}
	// if maximum lateral derivation of a founded point is not greater than minXyDeriv 
	// then determine its elevation derivation
	var hm = trkseg[pntm][2];
	var hms = 0;						// elevation of point concerned on slope (P1, P2) 
	if (dmax <= minXyDeriv) {
		var h1 = trkseg[pnt1][2];
		var h2 = trkseg[pnt2][2];
		var l12 = gpxc.getLength([trkseg[pnt1][0], trkseg[pnt1][1], trkseg[pnt2][0], trkseg[pnt2][1]]);
		if (l12 > 0) {
			if (h1 < h2)
				hms = h1 + gpxc.getLength([trkseg[pnt1][0], trkseg[pnt1][1], trkseg[pntm][0], trkseg[pntm][1]]) / l12 * (h2 - h1);
			else
				hms = h2 + gpxc.getLength([trkseg[pntm][0], trkseg[pntm][1], trkseg[pnt2][0], trkseg[pnt2][1]]) / l12 * (h1 - h2);
		}
	}
	// if derivations are greater than minXyDeriv rsp. minElDeriv then simplify recursively
	if (dmax > minXyDeriv || Math.abs(hms - hm) > minElDeriv) {
		// recursive calls
		var recResults1 = gpxc.DouglasPeucker(trkseg, pnt1, pntm, minXyDeriv, minElDeriv);
		var recResults2 = gpxc.DouglasPeucker(trkseg, pntm, pnt2, minXyDeriv, minElDeriv);

		// build up result list
		recResults1.splice(-1);
		resultList = recResults1.concat(recResults2);
	}
	else	// delete points in between
		resultList = new Array(trkseg[pnt1], trkseg[pnt2]);

	return resultList;
}

/**
 * Replace elevation data using Open-Elevation Online Service
 * 
 * The service only allows POST sizes of about 2100 track points. Therefore the request for elevation data
 * is done in packages. It may be that after the first requests are sent the process hangs.
 *
 * @return	status code
 * @globals	gpxc._track
**/
gpxc.replaceElevationData = function() {
	var status = 0;
	var p = 2100;		// package size (#track points), maximum for open-elevation
	if (gpxc._track) {
		var trk = gpxc._track;
		for (s = 0; s < trk.length; s++) {			// loop over segments
			trkseg = trk[s];
			for (var k = 0; k <= Math.floor((trkseg.length-1)/p); k++) {	// in packages of p tracks
				var h = k*p;
				var latLngCollection = "";
				for (var j = 0; j < p; j++) {
					if (h+j >= trkseg.length)
						break;
					if (j == 0)
						latLngCollection = "{\"locations\": [{\"latitude\": " + trkseg[h+j][0] + ", \"longitude\": " + trkseg[h+j][1] + "}";
					else
						latLngCollection +=				  ", {\"latitude\": " + trkseg[h+j][0] + ", \"longitude\": " + trkseg[h+j][1] + "}";
				}
				latLngCollection += "]}";
				
				var result;
				if (result = gpxc.getElevationData(latLngCollection)) {
					for (var j = 0; j < p; j++) {
						if (h+j >= trkseg.length)
							break;
						trkseg[h+j][2] = result.results[j].elevation;
					}
				}
				else
					status = 600;
			}
			trk[s] = trkseg;
		}
		gpxc._track = trk;
		return status;
	}
	else
		return 600;
}

/**
 * Get elevation data from Open-Elevation Online Service
 *
 * @param	latLngCollection	List of coordinates for which elevation data are requested
 * @return	result				of Open-Elevation service
 *
**/
gpxc.getElevationData = function(latLngCollection) {
	var result = false;
	var url = "https://api.open-elevation.com/api/v1/lookup";
	var xhr = new XMLHttpRequest();
	xhr.open("POST", url, false);				// synchronous request
	xhr.setRequestHeader('Accept', 'application/json');
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function () {
		if (this.readyState != 4)
			return;
		if (this.status == 200)
			result = JSON.parse(this.responseText);
	};
	xhr.onerror = function () {					// continues here when request fails
		alert(clean_translation.bad_request);
		this.abort();
	}
	xhr.send(latLngCollection);					// waits until request is done
	if (result.error) {
		alert(result.error);
		return false;
	}
	return result;
}

/**
 * Complete edited track with elevation and time data
 * 
 * @globals	gpxc._track
**/

gpxc.completeTrack = function() {
	var trk = gpxc._track;
	var trk_no = 0;
	var polylines  = gpxm.map.getEditablePolylines();
	var new_track  = new Array();

	// get elevations for all single point tracks
	var w = 0;
	var latLngCollection = "{\"locations\": ";
	for (var s = 0; s < polylines.length; s++) {
		var polyline = polylines[s];
		var points = polyline.getPoints();

		if (points.length == 1)	{
			if (w++ == 0)
				latLngCollection += "[{\"latitude\": " + points[0].getLatLng().lat + ", \"longitude\": " + points[0].getLatLng().lng + "}";
			else
				latLngCollection +=	", {\"latitude\": " + points[0].getLatLng().lat + ", \"longitude\": " + points[0].getLatLng().lng + "}";
		}
	}
	latLngCollection += "]}";
	if (w > 0)
		var elevations = gpxc.getElevationData(latLngCollection);

	var t = 0;
	w = 0;
	for (var s = 0; s < polylines.length; s++) {
		var polyline = polylines[s];
		var points = polyline.getPoints();
		var new_seg = Array();

		if (points.length == 1) {			// treat single point track as way point
			var new_wpt = new Array (7);	// way point: lat, lon, ele, name, cmt, desc, sym
			new_wpt[0] = points[0].getLatLng().lat;
			new_wpt[1] = points[0].getLatLng().lng;
			new_wpt[2] = elevations.results[w].elevation;
			new_wpt[3] = '';
			new_wpt[4] = 'Name-' + ++w;
			new_wpt[5] = '';
			new_wpt[6] = '';
			new_wpt[7] = '';
			gpxc._wpts.push(new_wpt);

			continue;
		}
		else if (trk_no > 0)
			continue;
		for (var p = 0; p < points.length; p++) {
			var new_pnt = new Array (4);			// track point: lat, lon, ele and time
			new_pnt[0] = points[p].getLatLng().lat;
			new_pnt[1] = points[p].getLatLng().lng;
			var q = null; 
			var r = null;
			if (points[p].context) {
				r = points[p].context.originalPolylineNo;
				q = points[p].context.originalPointNo;
			}
			if (trk != null && q !== null && r !== null) {	// take original ele and time data
				new_pnt[2] = trk[r][q][2];
				new_pnt[3] = trk[r][q][3];
			}
			else {				// take ele and time data of previous point, if possible
				if (p == 0) {
					new_pnt[2] = '';
					var latLng = JSON.stringify({"locations": [{"latitude": new_pnt[0], "longitude": new_pnt[1]}]});
					var result;
					if (result = gpxc.getElevationData(latLng))
						new_pnt[2] = result.results[0].elevation;
					new_pnt[3] = '';
				}
				else {
					new_pnt[2] = new_seg[p-1][2];
					new_pnt[3] = new_seg[p-1][3];
				}
			}
			new_seg[p] = new_pnt;
		}
		if (new_seg.length > 0)
			new_track[t++] = new_seg;
		trk_no++;
	}
	gpxc._track = new_track;
}

/**
 * Create a new content for the GPX file
 * 
 * @param label		name of the track
 * @param cleaned	t/f: track was cleaned
 * @param replaced	t/f: elevation data were replaced
 * @return			content of GPX file
**/
gpxc.newTrack = function(label, cleaned, replaced) {
	var ele, nam, cmt, desc, desc1, sym, time;
	var wpts = gpxc._wpts;
	if (!gpxc._attributes)
		gpxc._attributes =	'version="1.1" creator="WP, GPX Viewer"'
						+	' xmlns="http://www.topografix.com/GPX/1/1"'
						+	' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
						+	' xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"'
						+	' xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"'
						+	' xmlns:gpxtrkx="http://www.garmin.com/xmlschemas/TrackStatsExtension/v1"'
						+	' xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2"'
						+	' xmlns:locus="http://www.locusmap.eu"';
	//
	// ---------- GPX Header -----------------------------------------------------
	//
	var gpxText = '<?xml version="1.0" encoding="utf-8"?>\n'
				+ '<gpx ' + gpxc._attributes + '>\n\n';

	//
	// ---------- Way points ------------------------------------------------------
	//
	var wpt = new Array (7);
	for (w = 0; w < wpts.length; w++) {
		wpt = wpts[w];
		gpxText 			+= '	<wpt lat="' + wpt[0] + '" lon="' + wpt[1] + '">\n';
		ele = wpt[2];
		if (ele == null || ele == "undefined")    
			ele = "--";
		if (! isNaN (ele))    
			gpxText 		+= '		<ele>' + ele + '</ele>\n';
		tim = wpt[3];
		if (tim != "")       
			gpxText 		+= '		<time>' + tim + '</time>\n';
		nam = wpt[4];
		if (nam != "")       
			gpxText 		+= '		<name>' + nam + '</name>\n';
		cmt = wpt[5];
		if (cmt != "")        
			gpxText 		+= '		<cmt>' + cmt + '</cmt>\n';
		desc = wpt[6];
		if (desc != "")       
			gpxText 		+= ' 		<desc>' + desc + '</desc>\n';
		sym = wpt[7];
		if (sym != "")        
			gpxText 		+= '		<sym>' + sym + '</sym>\n';
		if (gpxc._wpt_extension != "")        
			gpxText 		+= '		<extensions>' + gpxc._wpt_extension + '\t</extensions>\n';
		gpxText 			+= '	</wpt>\n';
	}
	//
	// ---------- Tracks ---------------------------------------------------------
	//
	if (gpxc._track) {
		trk = gpxc._track;
		var dist	= gpxc.totalDistance(trk, true);
		var hm		= gpxc.calcAscentDescent(trk, true);
		var rauf	= (hm.length == 2)? hm[0] : "--";
		var runter	= (hm.length == 2)? hm[1] : "--";
		var noEle	= (hm.length == 0)? true : false;
		label = (label == "")? gpxc._trkName : label;
		gpxText 			+= '	<trk>\n';
		gpxText 			+= '		<name>' + label + '</name>\n';
		gpxText 			+= '		<cmt> distance: ' + dist + ' km, up: ' + rauf + ' m, down: ' + runter + ' m</cmt>\n';
		desc = "";
		if (!cleaned && !replaced)
			desc = "original data of track points";
		if (cleaned && !replaced)
			desc = "track points cleaned";
		if (replaced) {
			desc = "elevation data replaced";
			if (cleaned)
				desc += " and smoothed";
		}
		if (noEle)
			desc += ", no elevation data";
		gpxText 			+= '		<desc>' + trk.length + ' track segments, ' + desc + '</desc>\n';
		if (gpxc._trk_extension != "")        
			gpxText 		+= '		<extensions>' + gpxc._trk_extension + '\t</extensions>\n';
		for (s = 0; s < trk.length; s++) {
			trkpnts = trk[s];
			if (Array.isArray(trkpnts)) {
				gpxText 	+= '		<trkseg>\n';
				for (p = 0; p < trkpnts.length; p++) {
					trpt = trkpnts[p];
					gpxText += '			<trkpt lat="' + trpt[0] + '" lon="' + trpt[1] + '">\n';
					ele	 = trpt[2];
					time = trpt[3];
					if (! isNaN(ele) && ele != "")      
						gpxText	
							+= '				<ele>' + trpt[2] + '</ele>\n';
					if (time != "")         
						gpxText	
							+= '				<time>' + trpt[3] + '</time>\n';
					gpxText += '			</trkpt>\n';
				}
				gpxText 	+= '		</trkseg>\n';
			}
		}
		gpxText 			+= '	</trk>\n';
	}
	//
	// ---------- GPX Trailer
	//
	gpxText += '</gpx>\n';
	
	return gpxText;
}


/**
 * Calculate distance between two points in meters
 * 
 * The distance between circles of latitudes is always the same:
 * 		circumference of the earth  / 360° = 40075017 m  / 360 = 111300 m
 * The distance between circles of longitudes variies depending on the latitude. 
 * At the equator it is also 111300 m, meanwhile at the poles it is zero.
 * Thus the distance is 111300 m * cos(lat).
 * 
 * @param	line	between two points [lat1, lon1, lat2, lon2]
 * @return			distance in meters
**/

gpxc.getLength = function(line) {
	var lat, lng, deltaLat, deltaLon;
	deltaLat = gpxc._meterJeGradLat * (line[0] - line[2]);		// [m]
	lat = (line[0] + line[2]) / 2;      						// mean value
	deltaLon = gpxc._meterJeGradLon (lat) * (line[1] - line[3]);// [m]
	if (deltaLat == 0)      
		lng = deltaLon;
	else if (deltaLon == 0)       
		lng = deltaLat;
	else if (deltaLat == 0 && deltaLon == 0) 
		lng = 0;
	else                                 
		lng = Math.sqrt ((deltaLat * deltaLat) + (deltaLon * deltaLon));
	if (isNaN (lng))                     
		lng = 0;
	return (lng);												// length [m]
}


/**
 * Calculate total distance of a track in kilometers
 * 
 * The distance between circles of latitudes is always the same:
 * 		circumference of the earth  / 360° = 40075017 m  / 360 = 111300 m
 * The distance between circles of longitudes variies depending on the latitude. 
 * At the equator it is also 111300 m, meanwhile at the poles it is zero.
 * Thus the distance is 111300 m * cos(lat).
 * 
 * @param	trk		track data
 * @param	rd		true/false: with/without rounding
 * @return			distance in kilometers
**/

gpxc.totalDistance = function(trk, rd) {
	var lat, lng, deltaLat, deltaLon, deltaEle;
	var dist = 0;     								// track distance [m]
	
	for (s = 0; s < trk.length; s++) {				// loop over segments
		var trkpnts = trk[s];
		if (Array.isArray(trkpnts)) {
			for (var i = 0; i < trkpnts.length - 1; i++) {
				deltaLat = gpxc._meterJeGradLat * (trkpnts[i][0] - trkpnts[i+1][0]);		// [m]
				lat = Math.abs ((trkpnts[i][0] + trkpnts[i+1][0]) / 2);	// Mittelwert
				deltaLon = gpxc._meterJeGradLon (lat) * (trkpnts[i][1] - trkpnts[i+1][1]);	// [m]
				deltaEle = trkpnts[i][2] - trkpnts[i+1][2];     							// [m]
				if (isNaN(deltaEle))    
					deltaEle = 0;
				if (deltaLat == 0)            
					lng = deltaLon;
				else if (deltaLon == 0)         
					lng = deltaLat;
				else if (deltaLat == 0 && deltaLon == 0)  
					lng = 0;
				else                                    
					lng = Math.sqrt ((deltaLat * deltaLat) + (deltaLon * deltaLon));
				if (isNaN(lng))                         
					lng = 0;
				lng = Math.sqrt (lng*lng + deltaEle*deltaEle);
				dist += lng;						// [m]
			}
		}
	}
	dist = dist / 1000;								// [km]
	if (!rd)                       
		dist = +dist.toFixed (3);
	else if (dist < 20)             
		dist = +dist.toFixed (1);
	else                            
		dist = Math.floor (dist);
	return (dist);
}

/**
 * Calculate total ascent resp. descent in meters
 * 
 * @param	trk		track data
 * @param	rd		true/false: with/without rounding
 * @return			total ascent/descent in meters or empty array
**/

gpxc.calcAscentDescent = function(trk, rd) {
	var d;
	var alt = new Array (0);
	var rauf = 0;
	var runter = 0;
	for (s = 0; s < trk.length; s++) {				// loop over segments
		var trkpnts = trk[s];
		if (Array.isArray(trkpnts)) {
			if (isNaN(trkpnts[0][2]))
				return (alt);
			for (var p = 1; p < trkpnts.length; p++) {
				if (isNaN(trkpnts[p][2]))
					return (alt);
				var h = trkpnts[p][2] - trkpnts[p-1][2];
				if (h >= 0)
					rauf += h;
				else
					runter -= h;
			}
		}
	}
	if (rd) {
		alt[0] = Math.round (rauf);
		alt[1] = Math.round (runter);
	} else {
		alt[0] = rauf;
		alt[1] = runter;
	}
	return (alt);
}
