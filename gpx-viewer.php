<?php
/**
 * Plugin Name:	GPX Viewer
 * Description:	A plugin to display GPX tracks with their elevation profile on OSM maps and to edit tracks interactively
 * Author:		axelkeller
 * Version:     2.2.9
 * License:		GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: gpx-viewer
*/
defined( 'ABSPATH' ) or die( '-1' );

define('GPXV_PLUGIN_DIR', basename( dirname( __FILE__ )));
define('GPXV_PLUGIN_BASENAME', plugin_basename(__FILE__));
define('GPXV_PLUGIN_URL', plugin_dir_url(__FILE__));
define('GPXV_PLUGIN_PATH', plugin_dir_path(__FILE__));

$upload_dir		= str_replace(array('/', '\\'), DIRECTORY_SEPARATOR, wp_upload_dir()['basedir']);
$realGpxPath	= $upload_dir.DIRECTORY_SEPARATOR."gpx".DIRECTORY_SEPARATOR;
$sitePath		= substr(substr(__FILE__, 0, strrpos(__FILE__,'wp-content')), 0, -1);
$relativeGpxPath= str_replace(array('/', '\\'), DIRECTORY_SEPARATOR, str_replace($sitePath, '', $realGpxPath));
define('GPXV_UPLOAD_PATH', $realGpxPath);
define('GPXV_UPLOAD_URL', get_site_url(null, $relativeGpxPath));


/*-------------
	HOOKS
--------------*/

register_activation_hook(GPXV_PLUGIN_BASENAME, 'gpxv_activate');
function gpxv_activate() {
}

register_deactivation_hook(GPXV_PLUGIN_BASENAME, 'gpxv_deactivate');
function gpxv_deactivate() {
}

register_uninstall_hook(GPXV_PLUGIN_BASENAME, 'gpxv_uninstall');
function gpxv_uninstall() {
	$gpxPath = substr(GPXV_UPLOAD_PATH, 0, -1);
	if (is_readable($gpxPath) && $gpxDirH = opendir($gpxPath)) {
		while (($catDir = readdir($gpxDirH)) !== false) {
			$catPath = $gpxPath.DIRECTORY_SEPARATOR.$catDir;
			if (is_dir($catPath) && $catDir != "." && $catDir != ".." && $catDirH = opendir($catPath)) {
				while (($gpxFile = readdir($catDirH)) !== false) {
                    $filePath = $catPath.DIRECTORY_SEPARATOR.$gpxFile;
                    if (is_file($filePath))
					unlink($filePath);
				}
				rmdir($catPath);
			}
		}
		rmdir($gpxPath);
	}
}

/**
 * Define style sheets and javascripts
 */
if (is_admin()) {
	add_action('admin_enqueue_scripts', 'gpxv_register_styles');
	add_action('admin_enqueue_scripts', 'gpxv_register_scripts');
}
else {
	add_action('wp_enqueue_scripts', 'gpxv_register_styles');
	if (!wp_is_block_theme())
		add_action('wp_enqueue_scripts', 'gpxv_register_scripts');
	// else: scripts have to be registered in callback of shortcode
}

function gpxv_register_styles() {
	wp_register_style('leaflet_style', GPXV_PLUGIN_URL.'css/leaflet.css', Array(), null, false);
	wp_enqueue_style('leaflet_style');
	wp_register_style('leaflet_style_scalebar', GPXV_PLUGIN_URL.'css/leaflet-betterscale.css', Array(), null, false);
	wp_enqueue_style('leaflet_style_scalebar');
	wp_register_style('gpxv_style', GPXV_PLUGIN_URL.'css/gpxViewer.css', Array(), null, false);
	wp_enqueue_style('gpxv_style');
}

function gpxv_register_scripts($initScript) {
	wp_register_script('leaflet', GPXV_PLUGIN_URL.'js/leaflet.js', Array(), null, true);
	wp_enqueue_script('leaflet');
	wp_register_script('leaflet_betterscale', GPXV_PLUGIN_URL.'js/leaflet-betterscale.js', Array('leaflet'), null, true);
	wp_enqueue_script('leaflet_betterscale');
	wp_register_script('leaflet_gpx', GPXV_PLUGIN_URL.'js/leaflet-gpx.js', Array('leaflet', 'leaflet_gpx-edit'), null, true);
	wp_enqueue_script('leaflet_gpx');
	wp_register_script('gpxv_map', GPXV_PLUGIN_URL. 'js/gpxMap.js', Array(), null, true);
	if ($initScript)
		wp_add_inline_script('gpxv_map', $initScript, 'after');
	wp_enqueue_script('gpxv_map');
	wp_register_script('gpxv_cleaner', GPXV_PLUGIN_URL.'js/gpxCleaner.js', Array(), null, true);
	wp_enqueue_script('gpxv_cleaner');
	wp_localize_script('gpxv_cleaner', 'clean_translation', array(
							'bad_request'		=>	__('Request for elevation data failed! Possibly you have to accept the link to https://api.open-elevation.com in your browser.', 'gpx-viewer')
							) 
					  );
	wp_register_script('leaflet_gpx-edit', GPXV_PLUGIN_URL.'js/leaflet-editable-polyline.js', Array('leaflet'), null, true);
	wp_enqueue_script('leaflet_gpx-edit');
	wp_localize_script('leaflet_gpx-edit', 'edit_translation', array(
							'slicing'			=>	__('slice track?', 'gpx-viewer')
							)
					  );
	wp_register_script('gpxv_functions', GPXV_PLUGIN_URL. 'js/gpxFunctions.js', Array(), null, true);
	wp_enqueue_script('gpxv_functions');
	wp_localize_script('gpxv_functions', 'gpxv_translations', array(
							'cleaning'			=>	__('Cleaning track... please wait', 'gpx-viewer'),
							'uploading'			=>	is_admin()? __('Uploading file...', 'gpx-viewer') : __('Loading file...', 'gpx-viewer'),
							'updating'			=>	__('Updating file...', 'gpx-viewer'),
							'no_file'			=>	__('No file selected or File API not supported!', 'gpx-viewer'),
							'wrong_type'		=>	__('File type not supported!', 'gpx-viewer'),
							'invalid_xml'		=>	__('Invalid XML structure!', 'gpx-viewer'),
							'no_track'			=>	__('No track points found in gpx file! Possibly containing route points', 'gpx-viewer'),
							'empty_track'		=>	__('No track points to store!', 'gpx-viewer'),
							'new_filename'		=>	__('new-track', 'gpx-viewer'),
							'no_data'			=>	__('No Data Error: No Valid Elevation Data Exists!', 'gpx-viewer'),
							'no_data2'			=>	__('no data', 'gpx-viewer'),
							'partial_success'	=>	__('Partial Success: Not all elevations were found within the SRTM coverage!', 'gpx-viewer'),
							'http_error'		=>	__('Bad HTTP Status Code:', 'gpx-viewer')
							) 
					  );
}

/**
 * Load the dashicons font
 */
add_action('wp_enqueue_scripts', 'enqueue_frontend_dashicons');
function enqueue_frontend_dashicons() {
    wp_enqueue_style('dashicons');
}

function gpx_view($atts) {

	if (!isset($atts['src']))
		return '';
	$options = get_option('gpx_viewer_options');
	
	$map_data = array(
				'autocenter'=> ($atts['src'] != 'newtrack' && $atts['src'] != '')? true : false,
				'lat'		=> $options['def_pos_lat'],
				'lon'		=> $options['def_pos_lon'],
				'zoom'		=> 10,			// zoom factor
				'width'		=> 100,			// %
				'height'	=> 500,			// px
				'reset'		=> true,		// show reset button
				'mousewheel' => true,
				'type' 		=> $options['map_type'],
				'open' 		=> true
	);

	$maptypes = array(
				'osm' => array(
						'label'		=> 'Open Street Map',
						'url'		=> '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
						'attribution'=> ' &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> | '.
										' &copy; <a href="http://opentopomap.org/about">OpenTopoMap</a>',
						'min_zoom'	=> 1, 
						'max_zoom'	=> 18
				),
				'otm' => array(
						'label'		=> 'Open Topo Map',
						'url'		=> '//{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
						'attribution'=> ' &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>, '.
										' &copy; <a href="http://opentopomap.org/about">OpenTopoMap</a>',
						'min_zoom'	=> 1, 
						'max_zoom'	=> 18
				)
	);

	$gpx_data = array(
				'src'			=> $atts['src'],
				'title'			=> isset($atts['title']) && !empty($atts['title']) ? $atts['title'] :  strtoupper(__('no named gpx', 'gpx-viewer')),
				'color'			=> isset($atts['color']) ? $atts['color'] : '#00ff00',
				'width'			=> isset($atts['width']) ? $atts['width'] : 5,
				'distance_unit'	=> isset($atts['distance_unit']) ? $atts['distance_unit'] : $options['distance_unit'],
				'height_unit'	=> isset($atts['height_unit'])   ? $atts['height_unit']   : $options['height_unit'],
				'step_min'		=> isset($atts['step_min'])? $atts['step_min'] : $options['step_min'],
				'download_button'=> isset($atts['download_button'])? $atts['download_button'] : true,
				'icon_url'		=> GPXV_PLUGIN_URL . 'images/'
	);

	// Add script to gpxMap.js, execute it to initialize map after page is loaded
	$script = ' gpxm.maptypes	= '.json_encode($maptypes, JSON_UNESCAPED_SLASHES).';
				gpxm.mapdata	= '.json_encode($map_data, JSON_NUMERIC_CHECK ).';
				gpxm.gpxdata	= '.json_encode($gpx_data, JSON_NUMERIC_CHECK).';
				gpxm.map 		= gpxm.Map('. (isset($atts['edit'])? "true" : "false") .');
			  ';

	if (is_admin() || !wp_is_block_theme())
		wp_add_inline_script('gpxv_map', $script, 'after');
	else
		gpxv_register_scripts($script);

	ob_start();

	include 'gpx-viewer-map.php';

	return  ob_get_clean();
}

/**
 *	Common display sequences
 */

function track_handling($clean, $replace, $type) {
	ob_start(); 
	?>
	<input	id="gpxv-success" type="hidden" name="success" value="" />
	<input	id="gpxv-error" type="hidden" name="error" value="" />
	<tr>
		<td style="text-align: right"><?php echo ($type == 'upload')? __("File to upload", 'gpx-viewer') : __("File to edit", 'gpx-viewer') ?>:</td>
		<td class="upload-dialog" colspan="3">
			<input	id="upload-input" 
					type="file"
				<?php if ($type == 'edit') : ?>
					onclick="document.getElementById('gpxv-message').style.display='none'"
				<?php endif ?>
			/>
		</td>
	</tr>
	<tr>
		<td style="text-align: right" nowrap><?php _e('New name of track', 'gpx-viewer') ?>:</td>
		<td>
			<input id="label" name="labelling" type="text" value="" size="15" style="width:auto"/>
		</td>
		<td colspan="2" style="font-style:italic">
			<?php _e('If empty, the given name of the track is kept.', 'gpx-viewer') ?>
		</td>
	</tr>
	<tr>
		<td style="text-align: right" nowrap>
			<?php if ($type == 'upload') 
			_e('Clean track data during file upload', 'gpx-viewer');
			else
			_e('Clean track data opening the file', 'gpx-viewer');
			?>:
		</td>
		<td colspan="3" style="font-style:italic" nowrap>
			<input 
			id="forceCleaning"
			name="cleaning" 
			type="checkbox" <?php echo $clean? "checked" : "" ?>
			value="<?php echo $clean ?>"
			onchange="gpxv_toggle()"
			/><?php _e('Reduce track points and smooth elevation profile', 'gpx-viewer') ?>:

			<input  
			style="margin-left:5px"
			id="slight"
			name="smoothFactor" 
			type="radio" <?php echo $clean == 1? " checked" : "" ?><?php echo !$clean? " disabled" : "" ?>
			value="1"
			/><?php _e('slight', 'gpx-viewer') ?>

			<input 
			style="margin-left:5px"
			id="medium"
			name="smoothFactor" 
			type="radio"<?php echo $clean == 2? " checked" : "" ?><?php echo !$clean? " disabled" : "" ?>
			value="2"
			/><?php _e('medium', 'gpx-viewer') ?>

			<input 
			style="margin-left:5px"
			id="strong"
			name="smoothFactor" 
			type="radio"<?php echo $clean == 3? "checked" : "" ?><?php echo !$clean? " disabled" : "" ?>
			value="3"
			/><?php _e('strong', 'gpx-viewer') ?>
		</td>
	</tr>
	<tr>
		<td></td>
		<td colspan="3" style="font-style:italic">
			<input 
			id="replaceElevation"
			name="replacing" 
			type="checkbox" <?php echo $replace? "checked" : "" ?>
			value="<?php echo $replace ?>"
			/><?php _e('Replace elevation data using Open-Elevation online service', 'gpx-viewer') ?>
		</td>
	</tr>
	<?php
	return  ob_get_clean();
}

function edit_help($type) {
	ob_start(); 
	?>
	<tr style="height:30px; <?php if ($type =='edit') echo "font-size:0.8em" ?> ">
		<td valign="top">(<?php _e('Zoom map until edit markers are shown; they are only shown if less than 100 track points are on the map', 'gpx-viewer') ?>.)</td>
	</tr>
	<tr <?php if ($type =='edit') echo 'style="font-size:0.8em"'?> >
		<td valign="top" >
			<ul style="list-style-type:disc; margin-bottom:0">
				<li><?php _e('drag the point marker to <b>move</b> the track point around', 'gpx-viewer') ?></li>
				<li><?php _e('right-click on point marker to <b>remove</b> the track point', 'gpx-viewer') ?></li>
				<li><?php _e('drag the middle point marker to <b>create</b> a new track point between two existing', 'gpx-viewer') ?></li>
				<li><?php _e('right-click on middle point marker to <b>split</b> the track into two track segments', 'gpx-viewer') ?></li>
				<li><?php _e('click on the first or last point marker to <b>add</b> a new first/last track point', 'gpx-viewer') ?></li>
				<br>
				<li><?php _e('double-click into the map to <b>create</b> the first point of a new track segment', 'gpx-viewer') ?><br>
					(<?php _e('Single track points are treated as way points when updated/stored.', 'gpx-viewer') ?>)</li>
			</ul>
		</td>
	</tr>
	<?php
	return  ob_get_clean();
}

/**
* Get track Attributes
*
* @param string $GPXFile	path of GPX file
* @return					array with distance ans height of track
*/
function getTrackAttributes($GPXFile) {
	$attr = array(
		'distance'	=> "",
		'height'	=> ""
	);
	$handle = fopen($GPXFile, "r");
	if ($handle) {
		while (($line = fgets($handle)) !== false) {
			if ($c = strpos($line, "<cmt>") && strpos($line, "</cmt>", $c)) {
				$d = strpos($line, "distance:", $c + 5);
				$k = strpos($line, ",", $d + 9);
				if ($d && $k)
					$attr['distance'] = trim(substr($line, $d + 9, ($k - $d - 9)));
				$h = strpos($line, "up:", $c + 5);
				$k = strpos($line, ",", $h + 3);
				if ($h && $k)
					$attr['height'] = trim(substr($line, $h + 3, ($k - $h - 3)));
				if ($attr['height'] == "-- m")
					$attr['height'] = "";
				break;
			}
		}
		fclose($handle);
	}
	return $attr;
}


if (is_admin()) {
	include 'gpx-viewer-admin.php';
}
else {
	include 'gpx-viewer-main.php';
}

?>
