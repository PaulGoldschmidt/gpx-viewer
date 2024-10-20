<?php
/**
 * 
 * @author axelkeller
 *
 */
if ( ! defined( 'ABSPATH' ) ) exit;
  
/**
* Add shortcode for gpx file list and map or for editable map
*
* @param array $atts		Attributes from shortcode entry
*/
add_shortcode('gpx-view', 'gpxv_shortcode');
function gpxv_shortcode($atts) {
	global $wpdb;

	ob_start();
	$relativeGpxUrl = substr(GPXV_UPLOAD_URL, strpos(GPXV_UPLOAD_URL, ':') + 1);
	$track_color 	= (isset($atts['color']) && preg_match("/^#([0-9a-f]{3}){1,2}$/i" , $atts['color']))?
						$atts['color'] : '#00ff00';
	$track_color	= (isset($_POST['track-color']))? $_POST['track-color'] : $track_color;
	$track_width 	= (isset($atts['width']) && is_numeric($atts['width']))?
						$atts['width'] : 5;
	$track_width	= (isset($_POST['track-width']))? $_POST['track-width'] : $track_width;
	$file_url		= '';
	$track_name		= '';
	$success		= '';
	$error			= '';

	// Display file list and map
	if (isset($atts['category'])) {

		// Get category slug
		//------------------
		$sql = 	"SELECT ".$wpdb->prefix."terms.slug, ".$wpdb->prefix."terms.name
				FROM ".$wpdb->prefix."term_taxonomy, ".$wpdb->prefix."terms
				WHERE ".$wpdb->prefix."term_taxonomy.taxonomy = 'category'
				AND ".$wpdb->prefix."terms.term_id = ".$wpdb->prefix."term_taxonomy.term_id
				AND ".$wpdb->prefix."term_taxonomy.parent = 0";
		$terms = $wpdb->get_results($sql);
		if ($terms) {
			foreach ($terms as $term) {
				if ($term->name == $atts['category'])
					break;
			}
		}
		if (isset($term->name) && $term->name != $atts['category']) :
		?>
			<div class="gpx-upload"><?php _e('Category not found', 'gpx-viewer') ?>: <label><strong><?php echo $atts['category'] ?></strong></label><br></div>
		<?php
			return ob_get_clean();
		endif;

		// Get filenames for category
		//---------------------------
		$myGpxFileNames = array();
		$searchPath		= GPXV_UPLOAD_PATH.$term->slug;
		if (is_readable($searchPath) && $handle = opendir($searchPath)) {		
			while (false !== ($file = readdir($handle))) {
				if (preg_match('/.gpx$/i', $file)) {
					$myGpxFileNames[$file] = array(
						'category'	=> $atts['category'],
						'slug'		=> $term->slug
						);					
				}
			}
			closedir($handle);
		}
		ksort($myGpxFileNames);

		// prepare displaying map only
		if (isset($atts['gpx-file'])) {
			foreach ($myGpxFileNames as $file => $props) {
				if ($atts['gpx-file'] == $file) {
					$file_url = $relativeGpxUrl.$term->slug.DIRECTORY_SEPARATOR.$file;
					$track_name = substr($file, 0, strripos($file, '.gpx'));
				}
			}
		}

		// display file list for selection
		else {
			if (isset($_POST['gpx-file'])) {
				$i = 0;
				foreach ($myGpxFileNames as $file => $props) {
					$name = substr($file, 0, strripos($file, '.gpx'));
					$i++;
					if ($_POST['gpx-file'] == $name)
						$_POST['gpx-nr'] = $i;
				}
			}

			// Display selectable filenames
			//-----------------------------
			if (isset($_POST['gpx-nr'])) : ?>
			<script>
			document.addEventListener("DOMContentLoaded", function(event) {
				a_file = document.getElementById('delta1');
				a_list = document.getElementById('delta2');
				if (a_file.href != 'gpxfile-3') {
					a_file.click();
					a_list.click();
				}
			});
			</script>
			<?php endif ?>
			
			<div class="gpxv-params">
			<form action="" method="post">
				<div class="gpxv-option">
					<label><?php _e('Color of Track', 'gpx-viewer') ?>: </label>
					<input
						type="color"
						name="track-color"
						value="<?php echo $track_color ?>" />

					<label><?php _e('Width of Track', 'gpx-viewer') ?>: </label>
					<select
						name="track-width"
						value="<?php echo $track_width?>">
						<?php for ($i = 2; $i <= 10; $i++) {
							$selected = ($i == $track_width)? 'selected="selected"' : '';
						?>
							<option <?php echo $selected?> ><?php echo $i?></option>
						<?php } ?>
					</select>
				</div>

				<div id="gpxv-list" class="gpxv-head">
					<p><?php _e('GPX Tracks', 'gpx-viewer') ?></p>
					<div><input type='search' list="names" placeholder="<?php _e('Search term', 'gpx-viewer') ?>" autocomplete="off" name="gpx-file" value='' onchange="submit()"/></div>
					<div class="dashicons dashicons-search"></div>
					<datalist id="names" size="16">
						<?php foreach ($myGpxFileNames as $file => $props) : 	
						$name = substr($file, 0, strripos($file, '.gpx')); ?>
						<option value="<?php echo $name ?>" >
						<?php endforeach; ?>
					</datalist> 
					<?php $sel = (isset($_POST['gpx-nr']))? $_POST['gpx-nr'] : 0; ?>
					<a id="delta1" href="#gpxfile<?php echo ($sel - 3) ?>"></a>
					<a id="delta2" href="#gpxv-list"></a>
				</div> 				
				<?php		
				
				// Display track list
				//------------------- ?>
				<div class="gpxv-list">
					<table class="gpxv-select">
						<tbody>
							<?php if (count($myGpxFileNames) == 0) : ?>
							<tr>
								<td colspan="1" align="center"><?php _e('No gpx files found', 'gpx-viewer') ?></td>
							</tr>
							<?php endif;
							$count = 0;
							$sel = (isset($_POST['gpx-nr']))? $_POST['gpx-nr'] : 0;
							$file_url = '';
							$track_name = '';
							foreach ($myGpxFileNames as $file => $props) {
								$filePath	= $searchPath.DIRECTORY_SEPARATOR.$file;
								$trackAttr	= getTrackAttributes($filePath);
								$selrow = '';
								$name = substr($file, 0, strripos($file, '.gpx'));
								if ($props['category'] == $atts['category']) {
									$count++;
									if ($count == $sel) {
										$selrow = 'class="selected"';
										$track_name = $name;
										$file_url = $relativeGpxUrl.$term->slug.DIRECTORY_SEPARATOR.$file;
									}
							?>
							<tr class="gpx-file">
								<td id="gpxfile<?php echo $count ?>" <?php echo $selrow ?> >
									<button type="submit" name="gpx-nr" value="<?php echo $count ?>"><?php echo $name ?></button>
								</td>
								<td align="right"><?php echo $trackAttr['distance'] ?></td>
								<td align="right"><?php echo str_replace(" m", " Hm", $trackAttr['height']) ?></td>
							</tr>
							<?php
								}
							}
							if ($count == 0 && count($myGpxFileNames) > 0) :
							?>
							<tr>
								<td><?php _e('No gpx files found for selected category', 'gpx-viewer'); echo ": ".$atts['category'] ?></td>
							</tr>
							<?php endif ?>
						</tbody>
					</table>
				</div>

			</form>	
			</div>
			<?php
		}

		// Display map with track
		//-----------------------
		?>
		<div class="gpxv-view">
			<?php echo gpx_view(array('src' => $file_url, 
									'title' => $track_name,
									'color' => $track_color,
									'width' => $track_width,
									'download_button'=> true)
								); ?>
		</div>
		<?php
	}
	// Display map for editing
	else {
		if (isset($_POST['success']) && $_POST['success'])
			$success = $_POST['success'];
		if (isset($_POST['error']) && $_POST['error'])
			$error = $_POST['error'];

		$newtrack = isset($_POST['newtrack']);
		$clean	 = (isset($_POST) && isset($_POST['cleaning']))? 2 : 0;
		$replace = (isset($_POST) && isset($_POST['replacing']))? 'on' : '';

		$options = get_option('gpx_viewer_options');
		$minXyDeriv		 = isset($options['min_xy_derivation'])? $options['min_xy_derivation'] : "8";
		$minElDeriv		 = isset($options['min_el_derivation'])? $options['min_el_derivation'] : "4";
		$maxSpikeRatio	 = isset($options['max_spike-ratio'])? $options['max_spike-ratio'] : "0.5";
		
		// Display page with editable map
		//-------------------------------
		?>
		<form id="gpxv-load" method="post">
		<div class="gpxv-upload">
			<table>
				<col style="width:40%">
				<col style="width:auto">
				<col style="width:35%">
				<tr id="gpxv-message" >
					<td></td>
				<?php if ($success) : ?>
					<td  id="gpxv-successmessage" colspan="3" nowrap>&nbsp;<?php echo $success ?></td>
				<?php elseif ($error) : ?>
					<td  id="gpxv-errormessage" colspan="3" nowrap>&nbsp;<?php echo $error ?></td>
				<?php else : ?>
					<td></td>
				<?php endif ?>
				</tr>
				
				<?php echo track_handling($clean, $replace, 'edit') ?>
				
				<tr>
					<td></td>
					<td>
						<button 
							style="margin-bottom:1.0em"
							type="button"
							onclick="gpxv_open_file(document.getElementById('upload-input'),
												'<?php echo $minXyDeriv ?>',
												'<?php echo $minElDeriv?>',
												'<?php echo $maxSpikeRatio ?>')"
						>
						<?php _e('Open', 'gpx-viewer') ?>
						</button>
					</td>
					<td id="gpxv-progress" style="color:blue"></td>

					<td colspan="3" nowrap align="right">
						<button style="margin-bottom:1.0em" type="submit" name="newtrack">
						<?php _e('New Track', 'gpx-viewer') ?>
						</button>
					</td>
				</tr>
				<tr style="height:30px">
					<td valign="top"><u><?php _e('Editing track', 'gpx-viewer') ?></u></td>
					<td colspan="3" rowspan="3">
					<?php echo gpx_view(array('src' => isset($_POST['newtrack'])? 'newtrack' : '',
											'title' => '',
											'color' => $track_color,
											'width' => 5,
											'edit'	=> true,
											'download_button'=> false)
										);
					?>
					</td>
				</tr>
				
				<?php echo edit_help('edit')?>
				
				<tr>
					<td></td>
					<td id="storebutton" <?php echo ($newtrack? '' : 'hidden') ?> >
						<button 
							type="button"
							onclick="gpxv_store_edited_track()">
						<?php _e('Store', 'gpx-viewer') ?></button>
					</td>
					<td id="gpxv-progress2" style="color:blue"></td>
				</tr>
			</table>
		</div>
	<?php
	}
	?>
	<div>&nbsp;</div>
	<?php
	return ob_get_clean();
}

