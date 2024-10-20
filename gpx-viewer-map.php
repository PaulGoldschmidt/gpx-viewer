<?php
/**
 * Template for div containing the map 
 * and for the elevation profile with track informations
 * @author axelkeller
*/

if ( ! defined( 'ABSPATH' ) ) exit;
?>
<div id="map-container" class=" small-viewport">

	<!-- Hook for the Leaflet Map -->
	<div id="leaflet-map"></div>

	
	
	<div id="track" class="track-info" <?php echo ($gpx_data['src'] && $gpx_data['src'] != ' ')? '' : 'hidden' ?> >
		<h3>
			<span id="gpx-title"><?php echo stripslashes($gpx_data['title'])?>&nbsp;</span>
			<?php if ($gpx_data['download_button']) : ?>
			<a  href="<?php echo $gpx_data['src']?>"  download="<?php echo basename($gpx_data['src']);?>" class="gpx-file"  >
				<span class="dashicons dashicons-download"></span>GPX
			</a>
			<?php endif;?>
		</h3>
		<div class="content" >
			<svg class="elevation-profile"  viewBox="0 0 290 230" >
				<defs>
					<marker id="t" markerWidth="4" markerHeight="4" orient="auto" refY="2" refX="3">
					<path d="M0,0 L4,2 0,4" fill="#000"></path>
					</marker>
				</defs>
				<g transform="translate(50,10)">
				<!-- horizontal -->
				<!-- y = 50 (180-50)-->
				<line class="line" x1="-5" y1="160" x2="220" y2="160"></line>
				<text class="h1 line" x="-5" y="160" text-anchor="end">50</text>
				<line class="line" x1="-5" y1="120" x2="220" y2="120"></line>
				<text class="h2 line" x="-5" y="120" text-anchor="end">100</text>
				<line class="line" x1="-5" y1="80" x2="220" y2="80"></line>
				<text class="h3 line" x="-5" y="80" text-anchor="end">150</text>
				<line class="line" x1="-5" y1="40" x2="220" y2="40"></line>
				<text class="h4 line" x="-5" y="40" text-anchor="end">200</text>
				<!-- Vertical -->
				<g class="v1" transform="translate(60,0)">
					<line class="line" x1="0" y1="0" x2="0" y2="185"></line>
					<text  class="line" x="0" y="193" text-anchor="middle">5</text>
				</g>
				<g class="v2" transform="translate(120,0)">
					<line class="line" x1="0" y1="0" x2="0" y2="185"></line>
					<text  class="line" x="0" y="193" text-anchor="middle">10</text>
				</g>
				<g class="v3" transform="translate(180,0)">
					<line class="line" x1="0" y1="0" x2="0" y2="185"></line>
					<text id="v3" class="line" x="0" y="193" text-anchor="middle">15</text>
				</g>
				<!-- cadre  -->
				<rect x="0" y="0" width="220" height="180" ></rect>
				<!-- horizontal axis x -->
				<line class="axis" x1="0" y1="180" x2="210" y2="180"  marker-end="url(#t)"></line>
				<text x="110" y="210" text-anchor="middle"><?php echo ucfirst(__('distance', 'gpx-viewer'))?> (<?php echo $gpx_data['distance_unit'] ?>)</text>
				<!-- vertical axis y -->
				<line class="axis" x1="0" y1="180" x2="0" y2="10" marker-end="url(#t)"></line>
				<text x="0" y="0" transform="rotate(-90) translate(-100, -40)" text-anchor="middle"><?php ucfirst( __('elevation', 'gpx-viewer'))?> (<?php echo $gpx_data['height_unit'] ?>)</text>
				<path class="profile-line" d=""></path>
			
				<line class="move-line" x1="0" y1="185" x2="0" y2="-5"></line>
				</g>
			</svg>
			<div class="gpx-no-data"><?php echo ucfirst(__('no elevation data', 'gpx-viewer'))?></div>
			<table class="properties">
				<tr>
					<td ><?php echo ucfirst(__('name' ,'gpx-viewer'))?>: </td>
					<td class="gpx-name"><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr>
					<td><?php echo ucfirst(__('distance', 'gpx-viewer'))?>: </td>
					<td class="gpx-distance"><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr>
					<td><?php echo ucfirst(__('minimum elevation', 'gpx-viewer'))?>: </td>
					<td  class="gpx-min-elevation" ><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr>
					<td><?php echo ucfirst(__('maximum elevation', 'gpx-viewer'))?>: </td>
					<td  class="gpx-max-elevation" ><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr>
					<td><?php echo ucfirst(__('elevation gain', 'gpx-viewer'))?>: </td>
					<td  class="gpx-elevation-gain" ><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr >
					<td><?php echo ucfirst(__('elevation loss', 'gpx-viewer'))?>: </td>
					<td class="gpx-elevation-loss" ><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
				<tr>
					<td><?php echo ucfirst(__('duration', 'gpx-viewer'))?>: </td>
					<td class="gpx-duration" ><em><?php echo ucfirst(__('no data', 'gpx-viewer'))?></em></td>
				</tr>
			</table>
		</div>
	</div>
</div>

