<?php
/**
* Admin page of GPX-Viewer
* for uploading gpx files and display settings
* @author axelkeller
*/
if ( ! defined( 'ABSPATH' ) ) exit;

/*-------------
 *	HOOKS
 *------------*/

/**
 * Setup Options for GPX Viewer
 */
add_action('admin_init', 'gpxv_settings_init');
function gpxv_settings_init() {
	$distance_units	= array (
					'km' => __('kilometer', 'gpx-viewer'),
					'mi' => __('miles', 'gpx-viewer')
					);

	$height_units	= array (
					'm'  => __('meter', 'gpx-viewer'),
					'ft' => __('foot', 'gpx-viewer')
					);

	$options = get_option('gpx_viewer_options');
	register_setting('gpxviewer', 'gpx_viewer_options');
	
	add_settings_section('gpxv_section1', 
						__('Map', 'gpx-viewer'), 
						'gpxv_display_section',
						'gpxviewer');
	
	add_settings_field('gpxv_field_1',
						__('Default Map Type', 'gpx-viewer'),
						'gpxv_display_radio_buttons',
						'gpxviewer',
						'gpxv_section1',
						[	'name'			=> 'map_type',
							'default_value'	=> 'osm',
							'description'	=> __('Open Street Map', 'gpx-viewer'),
						]);

	$value = isset($options['def_pos_lat'])? $options['def_pos_lat'] : "48.13713899523178";
	add_settings_field('gpxv_field_11',
						__('Default Position', 'gpx-viewer'),
						'gpxv_display_textinput',
						'gpxviewer',
						'gpxv_section1',
						[	'name'			=> 'def_pos_lat',
							'default_value'	=> $value,
							'description'	=> __('Latitude', 'gpx-viewer'),
						]);

	$value = isset($options['def_pos_lon'])? $options['def_pos_lon'] : "11.57538418725798";
	add_settings_field('gpxv_field_12',
						'',
						'gpxv_display_textinput',
						'gpxviewer',
						'gpxv_section1',
						[	'name'			=> 'def_pos_lon',
							'default_value'	=> $value,
							'description'	=> __('Longitude', 'gpx-viewer'),
						]);

	add_settings_section('gpxv_section2', 
						__('Elevation Data', 'gpx-viewer'), 
						'gpxv_display_section',
						'gpxviewer');
	
	add_settings_section('gpxv_section3', 
						__('Elevation Profile', 'gpx-viewer'), 
						'gpxv_display_section',
						'gpxviewer');
	
	$value = isset($options['distance_unit'])? $options['distance_unit'] : $distance_units[array_keys($distance_units)[0]];
	add_settings_field(	'gpxv_field_5',
						__('Distance Unit', 'gpx-viewer'),
						'gpxv_display_selection',
						'gpxviewer',
						'gpxv_section3',
						[	'name'			=> 'distance_unit',
							'default_value'	=> $value,
							'select_options'=> $distance_units,
							'description'	=> __('Distance unit for elevation profile', 'gpx-viewer'),
						]);
	$value = isset($options['height_unit'])? $options['height_unit'] : $height_units[array_keys($height_units)[0]];
	add_settings_field(	'gpxv_field_6',
						__('Height Unit', 'gpx-viewer'),
						'gpxv_display_selection',
						'gpxviewer',
						'gpxv_section3',
						[	'name'			=> 'height_unit',
							'default_value'	=> $value,
							'select_options'=> $height_units,
							'description'	=> __('Height unit for elevation profile', 'gpx-viewer'),
						]);
	$value = isset($options['step_min'])? $options['step_min'] : 10;
	add_settings_field(	'gpxv_field_7',
						__('Scaling Unit Minimum', 'gpx-viewer'),
						'gpxv_display_selection',
						'gpxviewer',
						'gpxv_section3',
						[	'name'			=> 'step_min',
							'default_value'	=> $value,
							'select_options'=> gpxv_generate_range(10,500,10),
							'description'	=> __('Choose the minimum unit in meters for scaling the elevation axis', 'gpx-viewer'),
						]);
}


add_action('admin_menu', 'gpxv_admin_pages');
function gpxv_admin_pages() {
	
	add_menu_page(
				__('GPX Files', 'gpx-viewer'),
				__('GPX Files', 'gpx-viewer'),
				'edit_posts' ,
				'gpx_admin',
				'gpxv_upload_page',
				GPXV_PLUGIN_URL.'images/marker.png',
				50);

	add_options_page(
				__('GPX Viewer', 'gpx-viewer'),
				__('GPX Viewer', 'gpx-viewer'),
				'manage_options',
				'gpxviewer',
				'gpxv_options_page_html');
}

function gpxv_generate_range( $min=0, $max=20, $step=1){
	$result = array();
	for( $i=$min; $i<$max+1; $i +=$step)
		$result[$i] = strval($i);
	return $result;
}

/**
 * AJAX request handling for file upload
 */
add_action("wp_ajax_gpxv_file_upload", "gpxv_file_upload");	// 'wp_ajax_<action>' defines action called in gpxFunctions.js
function gpxv_file_upload() {
	if ($_POST['action'] == 'gpxv_file_upload') {
		$target_path = GPXV_UPLOAD_PATH.$_POST['category']; 						
		$target_file = $target_path.DIRECTORY_SEPARATOR.$_POST['filename']; 						
		if (! $response = gpxv_check_repository($target_path)) {
			// change all \' and \" back to ' and " , which were changed for upload
			if (file_put_contents($target_file, str_replace("\'", "'", str_replace('\"', '"', $_POST['gpx']))) > 0) {
				if ($_POST['update'] == 'true')
					echo 's'.$_POST['filename'].': </strong>'.__('File has been updated.', 'gpx-viewer');
				else if ($_POST['clean'] == 'true')
					echo 's'.$_POST['filename'].': </strong>'.__('File has been cleaned and uploaded.', 'gpx-viewer');
				else
					echo 's'.$_POST['filename'].': </strong>'.__('File has been uploaded.', 'gpx-viewer');
			}
			else
				echo 'e'.$_POST['filename'].': </strong>'.__('File could not be stored!', 'gpx-viewer');
		}
		else
			echo 'e'.$response;
	}
	die();
}



/*-----------------
 *	PAGES
 *----------------*/

/**
 * display admin page
 */
function gpxv_options_page_html() {
	
	if (!current_user_can('manage_options'))
		return;
	?>
	<div class="wrap">
		<h1><?= esc_html(get_admin_page_title()); ?></h1>
		<form action="options.php" method="post">
	<?php
			settings_fields('gpxviewer');
			do_settings_sections('gpxviewer');
			submit_button(__('Save Changes'));
	?>
	</div>
	<?php
}

/**
 *	display section header of admin page
 */
 
function gpxv_display_section($args) {
	$id = esc_attr($args['id']);
	$title = esc_attr($args['title']);
	?>
	<p id="<?php echo $id; ?>"></p>
	<?php
}

/**
 *	display fields of a selection
 */
function gpxv_display_selection($args) {
	$value	= esc_attr($args['default_value']);
	?>
	<div>
		<select 
			name="gpx_viewer_options[<?php echo $args['name'] ?>]" 
			value="<?php echo $value?>">
	<?php	foreach($args['select_options'] as $key => $option) {
				$selected = ($key == $value)? 'selected="selected"' : '';
	?>
			<option value="<?php echo $key?>" <?php echo $selected?>><?php echo $option?></option>
	<?php	} 
	?>
		</select>
	</div>
	<p class="description">
		<?php esc_html_e($args['description'], 'gpx-viewer'); ?>
	</p>
	<?php
}

function gpxv_display_text($args) {
	$value	= esc_attr($args['default_value']);
	?>
	<div>
		<input 
			type="hidden" 
			name="gpx_viewer_options[<?php echo $args['name'] ?>]" 
			value="<?php echo $value ?>"/>
		<?php esc_html_e($args['description'], 'gpx-viewer'); ?>
	</div>
	<?php
}

function gpxv_display_textinput($args) {
	$value	= esc_attr($args['default_value']);
	?>
	<div>
		<input 
			name="gpx_viewer_options[<?php echo $args['name'] ?>]"
			size="50"
			value="<?php echo $value ?>"/>
	</div>
	<p class="description">
		<?php esc_html_e($args['description'], 'gpx-viewer'); ?>
	</p>
	<?php
}

function gpxv_display_radio_buttons($args) {
	$options = get_option('gpx_viewer_options');
	?>
	<div>
		<input 
			type="radio" 
			name="gpx_viewer_options[<?php echo $args['name'] ?>]"
			value="osm" 
			<?php checked('osm', $options['map_type'], true); ?>> Open Street Map
		<br><br>
		<input 
			type="radio" 
			name="gpx_viewer_options[<?php echo $args['name'] ?>]"
			value="otm" 
			<?php checked('otm', $options['map_type'], true); ?>> Open Topo Map
	</div>
	<?php
}


/**	Display admin page area for upload and editing
 *	and for handling requests
 *	----------------------------------------------
 */
function gpxv_upload_page() {
	global $wpdb;
	
	// Get categories
	//------------------
	$sql = 	"SELECT ".$wpdb->prefix."terms.slug, ".$wpdb->prefix."terms.name
			FROM ".$wpdb->prefix."term_taxonomy, ".$wpdb->prefix."terms
			WHERE ".$wpdb->prefix."term_taxonomy.taxonomy = 'category'
			AND ".$wpdb->prefix."terms.term_id = ".$wpdb->prefix."term_taxonomy.term_id
			AND ".$wpdb->prefix."term_taxonomy.parent = 0";
	$cats = $wpdb->get_results($sql);
	$currentCat = $cats[0];
	?>
	<style>
		.update.settings-error {
			border-left-color: #46b450;
			margin-bottom: 20px;
		}
		.error.settings-error {
			border-left-color: #dc3232;
			margin-bottom: 20px;
		}
	</style>
	<div class="wrap">
		<h1 class="wp-heading-inline"><?php _e('GPX Files', 'gpx-viewer') ?></h1>
	<?php
	
	if ($msg = gpxv_check_repository(GPXV_UPLOAD_PATH)) {
		add_settings_error('upload', '', $msg, 'error');
		settings_errors('upload');
		return;
	}

	// Check selected category 
	//------------------------
	if (isset($_POST['category']) || isset($_GET['category'])) {
		$catname = (isset($_GET['category']))? $_GET['category'] : $_POST['category'];
		foreach ($cats as $category) {
			if ($category->slug == $catname) {
				$currentCat = $category;
				break;
			}
		}
	}
	// Record all gpx files and check if a file has to be deleted or edited
	//---------------------------------------------------------------------
	$myGpxFileNames = array();
	$file_url = false;			// of file to edit
	foreach ($cats as $category) {
		if ($category !== $currentCat)
			continue;
		$searchPath = GPXV_UPLOAD_PATH.$category->slug;
		if (is_readable($searchPath) && $handle = opendir($searchPath)) {
			while (false !== ($file = readdir($handle))) {
				if (preg_match('/.gpx$/i', $file)) {
					if (isset($_GET['delfile']) && $_GET['delfile'] == $file && $_GET['category'] == $category->slug) {
						$filepath = $searchPath.DIRECTORY_SEPARATOR.$file;
						if (file_exists($filepath)) {
							unlink($filepath);
							$msg = $file.": </strong>" . __(' File has been deleted.', 'gpx-viewer');
							add_settings_error('upload', '', $msg, 'update');
						}
					}
					else if (isset($_GET['editfile']) && $_GET['editfile'] == $file && $_GET['category'] == $category->slug) {
						$relativeGpxUrl = substr(GPXV_UPLOAD_URL, strpos(GPXV_UPLOAD_URL, ':') + 1);
						$file_url = $relativeGpxUrl.$currentCat->slug.DIRECTORY_SEPARATOR.$file;
					}
					else {
						$filePath	= $searchPath.DIRECTORY_SEPARATOR.$file;
						$trackAttr	= getTrackAttributes($filePath);
						$myGpxFileNames[$category->slug.$file] = array(
							'category'	=> $category->name,
							'slug'		=> $category->slug,
							'distance'	=> $trackAttr['distance'],
							'height'	=> $trackAttr['height'],
							'size'		=> gpxv_humanFileSize(filesize($filePath)),
							'lastedit'	=> date("d.m.Y H:i:s", filemtime($filePath))
							);					
					}
				}
			}
			closedir($handle);
		}
	}
	ksort($myGpxFileNames);
	
	if (isset($_POST['success']) && $_POST['success'])
		add_settings_error('upload', '', $_POST['success'], 'update');
	if (isset($_POST['error']) && $_POST['error'])
		add_settings_error('upload', '', $_POST['error'], 'error');
	settings_errors('upload');

	$clean	 = (isset($_POST) && isset($_POST['cleaning']))? 2 : 0;
	$replace = (isset($_POST) && isset($_POST['replacing']))? 'on' : '';

	$options = get_option('gpx_viewer_options');
	$minXyDeriv		 = isset($options['min_xy_derivation'])? $options['min_xy_derivation'] : "8";
	$minElDeriv		 = isset($options['min_el_derivation'])? $options['min_el_derivation'] : "4";
	$maxSpikeRatio	 = isset($options['max_spike-ratio'])? $options['max_spike-ratio'] : "0.5";

	$tmp   = ($file_url)? substr($file_url, strripos($file_url, DIRECTORY_SEPARATOR)+1) : '';
	$title = substr($tmp, 0, strripos($tmp, '.gpx'));
	
	// Display admin page
	//-------------------
	?>
	<form id="gpxv-upload" method="post" action="?page=gpx_admin">
		<div class="gpxv-upload">
			<label><?php _e('Category', 'gpx-viewer') ?> :
				<select name="category" onchange="submit()">
	<?php
	foreach ($cats as $category) {
		$sel = ($category === $currentCat)? 'selected="selected"' : '';
		echo '<option value="'.$category->slug.'" '.$sel.'>'.$category->name.'</option>
		';
	}
	?>
				</select>
			</label>
		</div>	
		<div class="gpxv-upload">
			<table>
				<col style="width:40%">
				<col style="width:5%">
				<col style="width:35%">
			
				<?php echo track_handling($clean, $replace, 'upload') ?>
				
				<tr>
					<td></td>
					<td><button 
						type="button"
						onclick="gpxv_upload_file(document.getElementById('upload-input'),
												'<?php echo $currentCat->slug ?>',
												'<?php echo admin_url('admin-ajax.php') ?>',
												'<?php echo $minXyDeriv ?>',
												'<?php echo $minElDeriv?>',
												'<?php echo $maxSpikeRatio ?>')"
						>
					<?php _e('Upload', 'gpx-viewer') ?></button></td>
					<td id="gpxv-progress" style="color:blue"></td>
				</tr>
				<?php if ($file_url) : ?>
				<tr>
					<td>&nbsp;</td>
				</tr>
				<tr style="height:30px">
					<td valign="top"><u><?php _e('Editing track', 'gpx-viewer') ?></u></td>
					<td colspan="3" rowspan="3">
					<?php echo gpx_view(array('src' => $file_url, 
											'title' => $title,
											'color' => '#00ff00',
											'width' => 5,
											'edit'	=> true)
						);
					?>
					</td>
				</tr>
				
				<?php echo edit_help('upload')?>
				
				<tr>
					<td></td>
					<td>
						<button 
							class="update-close-button"
							type="button"
							onclick="gpxv_update_edited_track(
											'<?php echo $file_url ?>',
											'<?php echo $currentCat->slug ?>',
											'<?php echo admin_url('admin-ajax.php') ?>'
									)">
						<?php _e('Update', 'gpx-viewer') ?></button>
						<button 
							class="update-close-button"
							type="submit">
						<?php _e('Close', 'gpx-viewer') ?></button>
					</td>
					<td id="gpxv-progress2"
						style="color:blue">
					</td>
				</tr>
				<?php endif ?>
			</table>
		</div>
	</form>
	<?php if (!$file_url) : ?>
	<br>
	<table class="wp-list-table widefat striped pages gpxv-table">
		<thead>
			<tr>
				<th><?php _e('File', 'gpx-viewer'); ?></th>
				<th><?php _e('Category', 'gpx-viewer') ?></th>
				<th style="text-align:right"><?php echo ucfirst(__('distance', 'gpx-viewer')) ?></th>
				<th style="text-align:right"><?php echo ucfirst(__('elevation gain', 'gpx-viewer')) ?></th>
				<th><?php _e('Last modified', 'gpx-viewer') ?></th>
				<th><?php _e('File size', 'gpx-viewer') ?></th>
			</tr>
		</thead>
		<tbody>
		<?php if (count($myGpxFileNames) == 0) : ?>
				<tr>
					<td colspan="6" align="center"><?php _e('No gpx files found', 'gpx-viewer') ?></td>
				</tr>
		<?php endif ?>
		<?php $count = 0;
		foreach ($myGpxFileNames as $key => $props) {
			$file = substr($key, strlen($props['slug']));
			if ($currentCat->name == $props['category']) {
				$count++;
				$href1 = '?page='.$_GET['page'].'&editfile='.urlencode($file).'&category='.$currentCat->slug;
				$href2 = '?page='.$_GET['page'].'&delfile='.urlencode($file).'&category='.$currentCat->slug;
				$name = '<strong class="gpxv-file">'.$file.'</strong><br>'.
						'<a href="'.$href1.'">'.__('Edit', 'gpx-viewer').'</a>'.
						' | '.
						'<a onclick="return confirm(\''. __('Are you sure you want to delete?', 'gpx-viewer').'\');" href="'.$href2.'">'.__('Delete', 'gpx-viewer').'</a>'.
						' | '.
						'<a href="'.GPXV_UPLOAD_URL.$props['slug']."/".$file.'" download="'.$file.'" >'.__('Download', 'gpx-viewer').'</a>';
			?>
			<tr>
				<td><?php echo $name ?></td>
				<td><?php echo $props['category'] ?></td>
				<td align="right"><?php echo $props['distance'] ?></td>
				<td align="right"><?php echo $props['height']?></td>
				<td><?php echo $props['lastedit'] ?></td>
				<td><?php echo $props['size'] ?></td>
			</tr>
			<?php
			}
		}
		if ($count == 0) : ?>
			<tr>
				<td><?php _e('No gpx files found for selected category', 'gpx-viewer') ?></td>
			</tr>
		<?php endif ?>
		</tbody>
	</table>
	<?php endif ?>
	
	</div>
	<?php
}

/**
* Check repository
*
* @param string $path		to be checked
* @return					error message if repository does not exist
*/
function gpxv_check_repository($path){
	if (!(file_exists($path) && is_dir($path)) && !@mkdir($path, 0755, true))
		return __("Can\'t create repository. Please create it and make it writable", 'gpx-viewer').": <b>$path</b>";
	elseif (!is_writable ($path))
		return __("Please make repository writable", 'gpx-viewer').": <b>$path</b>";
}

function gpxv_humanFileSize($bytes) {
	$thresh = 1024;
	if (abs($bytes) < $thresh)
		return $bytes.' B';

	$units = ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
	$u = -1;
	do {
		$bytes /= $thresh;
		++$u;
	} while(abs($bytes) >= $thresh && $u < count($units) - 1);
	return number_format($bytes, 1).' '.$units[$u];
}

