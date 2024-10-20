/**
 * Create a map that interacts with gpx track
 * 
 * @author axelkeller
 * 
 * derivated from lfhiker, modified and corrected
 * 
 * Modifications:	- Reduced to 1 map and 1 track,
 * 					- showing waypoints
 * 					- correct parameter setting
 * 
 * Corrections		- showing elevation profile if all elevation values are less than 0
 * 
 * @use L			leaflet
 * @use L.GPX		GPX extension for leaflet
*/

var gpxm = {};
gpxm.maptypes	= {};		// defined when Map is initialized
gpxm.mapdata	= {};		// defined when Map is initialized
gpxm.gpxdata	= {};		// defined when Map is initialized
gpxm.ZOOM_LIMIT = 11;		// zoom limit from which the markers are visible


/**
* Build the map with its markers, its gpx path and its controls
*
* @param gpxm.maptypes	types of map, e.g. OSM or OTM
* @param gpxm.mapdata	data for building the map
* @param gpxm.gpxdata	data for building the track and the elevation profile
*
**/
gpxm.Map = function(editable) {

	f = 0.2 + 0.1 * gpxm.gpxdata.width;
	if (f > 1.0) f = 1;
	var map_type = (gpxm.mapdata.type == 'osm')? gpxm.maptypes.osm : gpxm.maptypes.otm;
	
	gpxm.START_ICON = L.icon({		// icon for start point of path
		iconUrl:	gpxm.gpxdata.icon_url + 'marker-icon-start.png',
		iconSize: 	[32*f, 48*f], 
		iconAnchor:	[16*f, 48*f], 
	});
	gpxm.END_ICON = L.icon({		// icon for end point of path
		iconUrl:	gpxm.gpxdata.icon_url + 'marker-icon-end.png',
		iconSize:	[32*f, 48*f], 
		iconAnchor:	[16*f, 48*f], 
	});
	gpxm.MOVE_ICON = L.icon({		// icon for marker moving on path
		iconUrl:	gpxm.gpxdata.icon_url +'move.png',
		iconSize:	[15, 15], 
		shadowSize:	[0, 0], 
		iconAnchor:	[7, 7],
		shadowAnchor: [7, 7], 
		popupAnchor:  [7, 7]

	});
	gpxm.WPT_ICON = L.icon({		// icon for waypoint
		iconUrl:	gpxm.gpxdata.icon_url +'marker-icon-wpt.png',
		iconSize:	[32*f, 48*f], 
		iconAnchor:	[16*f, 48*f], 
	});
	gpxm.POINT_ICON = L.icon({		// icon for editing a point
		iconUrl:	gpxm.gpxdata.icon_url +'point-icon.png',
		iconSize:	[15, 15], 
		shadowSize:	[0, 0], 
		iconAnchor:	[7, 7],
		shadowAnchor: [7, 7], 
		popupAnchor:  [7, 7]
	});
	gpxm.NEW_POINT_ICON = L.icon({	// icon for creating new point
		iconUrl:	gpxm.gpxdata.icon_url +'new-point-icon.png',
		iconSize:	[15, 15], 
		shadowSize:	[0, 0], 
		iconAnchor:	[7, 7],
		shadowAnchor: [7, 7], 
		popupAnchor:  [7, 7]
	});

	// all private
	var _large = true; 					// "full screen"
	var _center = [0,0];				//default value from GPX Viewer settings
	var _zoom = 13;						// default value if not in data
	var _zoom_limit = gpxm.ZOOM_LIMIT;	// zoom from which the markers are visible
	var _auto_center = true;			// compute center and zoom from the elements added on map
	//remarquables layers
	var _gpx = null;					// layer from gpx file
	var _move_marker = null;			// marker which move on polyline according to profile
	var _layer_zoom = null;				// layer of elements which are displayed according to zoom
	var _latlonbounds = new Array();	// markers used for compute bounds of map if _auto_center
	
	var _displayed_view = null; 

	var d = gpxm.mapdata;
	_auto_center = d.autocenter;
	_zoom = Math.min(d.zoom, map_type.max_zoom);

	// Public, only map will be returned
	var map = L.map('leaflet-map', { dragging: !L.Browser.mobile, tap:!L.Browser.mobile });
	
	if (!_auto_center) {
		_center = [d.lat, d.lon];
		map.setView( _center, _zoom);
	}
	
	// Load map
	if (gpxm.gpxdata.src != '') {
		L.tileLayer(map_type.url,
					{
					attribution: map_type.attribution,
					minZoom: 1,
					maxZoom: map_type.max_zoom
					}
		).addTo(map);

		map.options.mousewheel = d.mousewheel;
		if (!d.mousewheel) {
			map.scrollWheelZoom.disable();
		}
		map.touchZoom.enable();

		// Add move marker
		_move_marker = L.marker(_center ,{icon: gpxm.MOVE_ICON});

		// Create a gpx object, add an event listener and laod the track
		_gpx = _add_gpx();

		//  Add control buttons after track has been loaded
		_add_control_buttons(d.reset);

		// Add scalebar
//		L.control.scale({maxWidth: 200, metric: true, imperial: false}).addTo(map);
		L.control.betterscale({maxWidth: 200, metric: true, imperial: false}).addTo(map);
	}
	// Add GPX track
	function _add_gpx() {
		var _gpx = new L.GPX(
				editable,
				{	async: true,
					isLoaded: false,
					elem_id: 'track',
					marker_options: {
						startIcon:	gpxm.START_ICON,
						endIcon:	gpxm.END_ICON,
						wptIcons:	{'': gpxm.WPT_ICON}
					},
					polyline_options: {
						color: 			'blue',
						maxMarkers:		100,
						pointIcon:		gpxm.POINT_ICON,
						newPointIcon: 	gpxm.NEW_POINT_ICON,
						newPolylines: 	true
					},
					gpx_options: {
						parseElements:	['track', 'route', 'waypoint']
					}
				}
			);

		// add listener
		_gpx.on('loaded', function(e) {
				e.target.options.isLoaded = true;
				e.target.setStyle({
					color:  gpxm.gpxdata.color,
					weight: gpxm.gpxdata.width});
				if (_auto_center) {
					var bounds = e.target.getBounds();
					_latlonbounds.push([bounds.getNorth(),bounds.getEast()]);
					_latlonbounds.push([bounds.getSouth(),bounds.getWest()]);
				}
				gpxm.Link(
						map,
						e.target,
						_move_marker,
						gpxm.gpxdata.distance_unit,
						gpxm.gpxdata.height_unit,
						gpxm.gpxdata.step_min);
			})
			.on('failed', function() {
				e.target.options.isLoaded = true;
				console.log("failed");
		});

		_gpx.load_track(gpxm.gpxdata.src);
		
		_gpx.addTo(map);
		
		return _gpx;
	}
	
	function _add_control_buttons(buttonreset) {
		var	isLoaded = (typeof _gpx != 'undefined' && _gpx.options.isLoaded);
		if (!isLoaded) {
			// wait until gpx files is loaded
			setTimeout(function() {_add_control_buttons( buttonreset);}, 500);
		} else {
			if (_latlonbounds.length > 0) {
				map.fitBounds(_latlonbounds);
			}
			_center = map.getCenter();
			_zoom = map.getZoom();
			
			// Add control buttons
			if (buttonreset)
				map.addControl(new gpxm.ResetControl(_center, _zoom));
			map.addControl(new gpxm.MapControl());
			map.addControl(new gpxm.ScreenControl());


			if (map_type.max_zoom < _zoom) {
				_zoom = map_type.max_zoom ;
				map.setZoom(_zoom);
			}
			_auto_center = true;
			
			_gpx.fire('click');	// creates profile below map
		}
	}
	return map;
}

gpxm.profile_displayed = false;


String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
}

/**
*  Add map button and reset button on top left of the map besides zoomin+zoomout
*  Map button: choose background map, reset button: recenter map to initial position
* @constructor
* @extend {L.Control} 
*/

gpxm.MapControl = L.Control.extend({
	options: {position: 'topleft'},
	onAdd : function(map) {
		var container = L.DomUtil.create('div', 'map-control');
		var img = L.DomUtil.create('img');
		img.setAttribute('src', gpxm.gpxdata.icon_url + 'maps.png');
		container.appendChild(img);
		
		
		var entry1 = L.DomUtil.create('div', 'map-select', container);
		
		var radio1 = L.DomUtil.create('input', '', entry1);
		entry1.innerHTML = (gpxm.mapdata.type == 'osm'? '&bullet; ' : '&nbsp; ') + gpxm.maptypes.osm.label;
		entry1.onclick = function() {
			var map_type = gpxm.maptypes.osm;
			L.tileLayer(map_type.url, {}).addTo(map);
			gpxm.mapdata.type = 'osm';
			entry1.innerHTML = '&bullet; ' + gpxm.maptypes.osm.label;
			entry2.innerHTML = '&nbsp; ' + gpxm.maptypes.otm.label;
		}
		var entry2 = L.DomUtil.create('div', ' map-select', container);
		entry2.innerHTML = (gpxm.mapdata.type == 'otm'? '&bullet; ' : '&nbsp; ') + gpxm.maptypes.otm.label;
		entry2.onclick = function() {
			var map_type = gpxm.maptypes.otm;
			L.tileLayer(map_type.url,{}).addTo(map);
			gpxm.mapdata.type = 'otm';
			entry1.innerHTML = '&nbsp; ' + gpxm.maptypes.osm.label;
			entry2.innerHTML = '&bullet; ' + gpxm.maptypes.otm.label;
		}
		return container;
	}
})

gpxm.ResetControl = L.Control.extend({
	options: {position: 'topleft'},
	_center: null,
	_zoom: 13,
	initialize: function(center, zoom) {
		this._center = center;
		this._zoom = zoom;
	},
	onAdd : function(map) {
		var container = L.DomUtil.create('div', 'map-control dashicons dashicons-update');
		var center = this._center;
		var zoom = this._zoom;
		container.onclick = function() {
			map.setView(center, zoom);
		}
		return container;
	}
})

/**
*  Add two buttons on top right : fullscreen and profile
* @constructor
* @extend {L.Control}
*/
gpxm.ScreenControl = L.Control.extend({
	options: {position: 'topright'}, 
	_displayed: null,
	initialize: function(displayed) {
		this._displayed = displayed;
	},
		
	onAdd: function (map) {
		var container = L.DomUtil.create('div', 'map-control-container');
		
		// Fullscreen toggle button
		var div1 = L.DomUtil.create('div', 'map-control screen-button dashicons');
		container.appendChild(div1);
		
		div1.onclick = function() {
			var map_container = L.DomUtil.get('map-container');
			var full = L.DomUtil.get('fullscreen');
			
			if (!document.fullscreenElement && !document.mozFullScreenElement &&
				!document.webkitFullscreenElement && !document.msFullscreenElement) {
				
				// Fullscreen button pressed
				this.className += ' active';
			
				if (map_container.requestFullscreen)
						map_container.requestFullscreen();
				else if (map_container.msRequestFullscreen)
					map_container.msRequestFullscreen();
				else if (map_container.mozRequestFullScreen)
					map_container.mozRequestFullScreen();
				else if (map_container.webkitRequestFullscreen)
					map_container.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
				
				map_container.className = map_container.className.replaceAll(' small-viewport', '');
				map.getContainer().style.height = "100%";
				
			} else {
				// Small viewport button pressed
				this.className = this.className.replace(' active','');
				
				if (document.exitFullscreen)
					document.exitFullscreen();
				else if (document.msExitFullscreen)
					document.msExitFullscreen();
				else if (document.mozCancelFullScreen)
					document.mozCancelFullScreen();
				else if (document.webkitExitFullscreen)
					document.webkitExitFullscreen();

				if (map_container.className.indexOf('small-viewport') < 0)
					map_container.className += ' small-viewport';
				map.getContainer().style.height = gpxm.mapdata.height;
				
				var track_info = L.DomUtil.get('track');
				track_info.className = track_info.className.replaceAll(' hidden', '');
			}
		}
		
		// Profile button
		var div2 =  L.DomUtil.create('div', 'map-control profile-button dashicons dashicons-chart-line');
		container.appendChild(div2);
		
		//append profile window to the map
		gpxm.Link(map, div2, null, null, null, null);

		return container;
	},
});

// Fullscreen change handler, small viewport via ESC
gpxm.changeHandler = function() {
	var map_container = L.DomUtil.get('map-container');

	if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullScreenElement) {
		if (map_container.className.indexOf('small-viewport') < 0)
			map_container.className += ' small-viewport';
	}
				
	var track_info = L.DomUtil.get('track');
	track_info.className = track_info.className.replaceAll(' hidden', '');
}
document.addEventListener("fullscreenchange", gpxm.changeHandler, false);
document.addEventListener("webkitfullscreenchange", gpxm.changeHandler, false);
document.addEventListener("mozfullscreenchange", gpxm.changeHandler, false);
document.addEventListener("msfullscreenchange", gpxm.changeHandler, false);


/**
* The link for synchronizing layer and info div node
* show/hide the Dom div when clicked on the layer
* @constructor
* @param {L.Map} map				the map concerned
* @param {L.GPX} layer				the gpx path
* @param {L.Marker} move_marker		the object _move_marker on the map (important only for gpx)
* @param {string} unit				km or miles (important only for gpx)
* @param {string} unit_h			m or ft (important only for gpx)
* @param {integer} step_min			the difference between max and min elevation axis (important only for gpx)
* @return {object <dom, layer, id >}
*/
gpxm.Link = function(map, layer, move_marker, unit, unit_h, step_min) {
	
	var _elem_id = 'track';
	var _dom = L.DomUtil.get(_elem_id);		// dom node of 'track' div
	
	if (_dom != null) {
		_add_event();

		if (layer instanceof L.GPX) {
			var profile = new gpxm.Profile(
					map, 
					layer , 
					_dom, 
					move_marker,
					unit,
					unit_h,
					step_min);
		}
	}

	// Toggle profile button on fullscrenn map
	function _toggle() {
		if (gpxm.profile_displayed) {
			//close profile window
			_dom.className = _dom.className + ' hidden';
			gpxm.profile_displayed = false;
		}
		else {
			// display profile window
			_dom.className = _dom.className.replaceAll(' hidden', '');
			if (layer instanceof L.GPX)
				move_marker.addTo(map); 
			gpxm.profile_displayed = true;
		}
	}
	
	function _add_event() {
		L.DomEvent.addListener(_dom, 'mousemove', function(e) {
			e.stopPropagation();
		});
		L.DomEvent.addListener(_dom, 'mousewheel', function(e) {
			e.stopPropagation();
		});
		
		if (layer instanceof L.Layer) {
			layer.on('click', function(e) {
				_toggle();
			});
		} else {
			L.DomEvent.addListener(layer, 'click', function(e) {
				_toggle();
			});
		}
	}

	return {dom: _dom, layer: layer, id: _elem_id};
}

/** 
*  round with its own order of magnitude 
*  @param float delta
*  @return int
*  @example
* 3       -> 3
* 9       -> 10
* 33      -> 50
* 68      -> 100
* 333     -> 500
* 820     -> 1000
* 8625    -> 10000*/
gpxm.step_round = function(delta) {
	var precision = Math.round( Math.log(delta)/Math.log(10) );
	var p = Math.pow (10, precision);
	var max = Math.ceil(delta / p) * p;
	return max/2 >= delta ? max/2 : max; 
}

/**
* Build the Profile for gpx path
* @constructor
* @param {L.Map} map			the map concerned
* @param {L.GPX} layer			the gpx path
* @param {DomNode} trackdata	the node link to the trackdata
* @param {L.Marker} move		the move_marker on polyline path 
*/
gpxm.Profile = function(map, layer, trackdata, move_marker, unit, unit_h, step_min) {
	if (unit == "km")
		var  _coeff = 1;
	else
		var _coeff = 1.60934;
	if (unit_h == "m")
		var _coeff_elevation = 1;
	else
		var _coeff_elevation = 0.3048;
	var _gpx = layer;
	var trackdata = trackdata;
	trackdata.querySelector('.gpx-name').textContent = _gpx.get_name();
	trackdata.querySelector('.gpx-distance').textContent = (Math.round(_gpx.get_distance()/(100*_coeff))/10).toString().replace('.' , ',')  + ' ' + unit;
	var seglen = _gpx.getLayers()[0].getLayers().length;
	var _data = _gpx.get_elevation_data();
	var _coords = Array(0);
	for (var i = 0; i < seglen; i+=3) {						// concatenate points of all segments
		var seg = _gpx.getLayers()[0].getLayers()[i];
		if (_coords.length < _data.length ) {
			_coords = _coords.concat(seg.getLatLngs());
		}
	}
	if (_gpx.get_elevation_max() != 0 || _gpx.get_elevation_min() != Infinity) {
//	if (_gpx.get_elevation_max() != 0) {
		var _has_elevation = true;
		var _max = _gpx.get_elevation_max() / _coeff_elevation;
		var _min = _gpx.get_elevation_min() / _coeff_elevation;
		var i0 = _data.length-1;
		while (i0> 0 && _data[i0][1] === null)
			i0--;
		var _max_km = _data[i0][0] / _coeff;
		var _step_h =  gpxm.step_round((_max - _min)/3.5);
		if (_step_h < step_min / ( _coeff_elevation)) {
			
			_step_h = gpxm.step_round( step_min/(_coeff_elevation)) ;
			_middle = Math.ceil((_max + _min)/2);
			_max = _middle + 2* _step_h;
		//  _min = _middle - 2* _step_h;
		}
		var _max_h = Math.ceil( _max/_step_h)*(_step_h);
		var _min_h = _max_h - 5 * _step_h;
		var _step_x = gpxm.step_round((_max_km)/4);
	} else {
		var _has_elevation = false;
	}
	
	function _x(km) {
		return km * 220 / (_max_km * _coeff);
	}
	function _h(h) {
		return (200 - (h/_coeff_elevation - _min_h)*40/_step_h);
	}
	function _compute() {
		var d= 'M ';
		var add = parseInt(_data.length /150)+1;
		var ln = _data.length;
		//find first point with elevation
		var i0 = 0;
		while( _data[i0][1] === null) {
			i0++;
		}

		d += Math.round(_x(_data[i0][0])) + ','+ Math.round(_h(_data[i0][1])) + ' L ';
		for(var i=i0; i < ln -add ; i = i + add) {
		
			var x = 0;
			var h = 0;
			for(var j=0;  j <add && i+j< ln ; j++) {
				var lg = 0;
				if (_data[ i +j ][1] != null) {
					x += _x(_data[i + j][0]);
					h += _h(_data[i + j][1]);
					lg++;
				}
			}
			if (lg != 0) {
				d += Math.round( x/add) + ','+ Math.round(h/add) + ' L ';
			}
			
		}
		// last point
		if (_data[ln-1][1] != null)
		d += _x(_data[ln-1][0]) + ','+ _h(_data[ln-1][1]);
		return d;
	}
	
	function draw() {
		if (_has_elevation) {
			// draw the curve
			var _d = _compute();
			trackdata.querySelector('.profile-line').setAttribute( 'd', _d);
			
			// write the value for elevation line
			for(var i=1;i<5; i++) {
				trackdata.querySelector('.h'+i).textContent = _min_h+i * _step_h;
			}
			// move the vertical line and write the value
			for(var i=1; i<4;i++) {
				var node = trackdata.querySelector( '.v'+i );
				var tr_x = Math.round( i * _step_x * 220 / _max_km );
				node.setAttribute( 'transform', 'translate(' + tr_x + ', 0)');
				if (tr_x > 220) {
					node.setAttribute('stroke-opacity', 0);
					node.querySelector('text').textContent = "";
				} else {
					var tx = 1;
					if (_step_x < 1) { tx =100;}
					node.querySelector('text').textContent = Math.round( i * _step_x * tx)/tx;
				}
			}
	
			trackdata.querySelector('.gpx-min-elevation').textContent = Math.round(_gpx.get_elevation_min()/_coeff_elevation) + ' ' + unit_h;
			trackdata.querySelector('.gpx-max-elevation').textContent = Math.round(_gpx.get_elevation_max()/_coeff_elevation) + ' ' + unit_h;
			trackdata.querySelector('.gpx-elevation-gain').textContent = Math.round(_gpx.get_elevation_gain()/_coeff_elevation) + ' ' + unit_h;
			trackdata.querySelector('.gpx-elevation-loss').textContent =  Math.round(_gpx.get_elevation_loss()/_coeff_elevation) + ' ' + unit_h;
			
			// add listener for moves over this profile
			L.DomEvent.addListener(trackdata.querySelector('svg') ,'click mousemove', 
									function(e) {_on_move(e)}, false);
			trackdata.querySelector('svg').addEventListener('touchmove', 
									function(e) {_on_move(e.touches[0])} )
		} else {
			// No data elevation : remove svg and info
			trackdata.querySelector('svg').parentNode.removeChild( trackdata.querySelector('svg'));
			trackdata.querySelector('.gpx-min-elevation').textContent = gpxv_translations.no_data2;
			trackdata.querySelector('.gpx-max-elevation').textContent = gpxv_translations.no_data2;
			trackdata.querySelector('.gpx-elevation-gain').textContent = gpxv_translations.no_data2;
			trackdata.querySelector('.gpx-elevation-loss').textContent = gpxv_translations.no_data2;
		}
		var _duration = _gpx.get_total_time();
		if (_duration)
			trackdata.querySelector('.gpx-duration').textContent = _gpx.get_duration_string(_duration, true);
	}
	function _on_move(e) {
		
		var svg =  trackdata.querySelector('svg');
		var position = svg.getBoundingClientRect();
		// compute if svg is scaled
		var scale = 290 / position.width;
		var x = e.pageX - position.left - window.pageXOffset;
		x = x*scale - 50;
		if (x<0)
			x = 0;
		if (x>220)
			x = 220;
		x = parseInt(x );
		trackdata.querySelector('.move-line').setAttribute('transform','translate(' + x + ',0)');
		
		var km = x * _max_km/220;
		var position = _find_position(km);
		move_marker.setLatLng(_coords[position]);
	}
	function _find_position(km) {
		var km = km * _coeff;
		var find = false;  
		var id = 0; 
		var iend = _data.length-1 

		while(!find && ((iend - id) > 1)) {
			var im = Math.ceil((id + iend)/2);  
			find = (_data[im] == km);  
			if (_data[im][0] > km)
				iend = im;  
			else
				id = im; 
		}
		return(id);  
	}
	draw();
	return {draw:draw};
}
