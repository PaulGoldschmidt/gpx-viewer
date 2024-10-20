=== GPX Viewer === 
Contributors: axelkeller  
Tags: map, GPX, track, elevation, openstreetmap, opentopomap
Requires at least: 4.9
Tested up to: 6.7.0
Stable tag: 2.2.9
Requires PHP: 7.2.24 or 8.*
License: GPLv2 or later  
License URI: http://www.gnu.org/licenses/gpl-2.0.html  


Display GPX tracks with their elevation profile on OSM maps, edit them interactively


== Description ==

Displays a GPX track as segmented polylines, the way points and the elevation profile.
Open Street Map (OSM) is used as background which can be switched between a plane view and a topographic one.
The view can be changed to full screen mode. Moving the cursor over the elevation profile the corresponding point is marked on the path interactively.

GPX tracks uploaded to the server in advance are stored into separate repositories that are ordered according to the categories setup in wordpress. 
Thus different collections of tracks can be handled and the tracks choosen from.

During upload a GPX track can be smoothed and/or its elevation data replaced by Open-Elevation Service data.
The latter is provided because many elevation data tracked by mobiles are not quite correct.

GPX trackpoints can be edited on the map interactively.

**Features**

* Admin page *GPX Files* for uploading tracks
  – Selecting category for repository
  – Replacing the description of the track (tag `<name>` in the GPX file)
  – Smoothing tracks during upload, thus reducing track points
  – Replacing elevation data of track points using Open-Elevation Service during upload
* Display of a specific, uploaded GPX track
  – PHP-function for inserting the view into a page
  – Selecting full screen mode and scaling the map
  – Switching between plane and topographic view
* Editing trackpoints on the map
  – Adding, moving, deleting track points
  – creating, splitting polylines
* Display of a list of GPX files from which a track can be selected
  – separated list for each category
  – Setting width and color of the path
  – Shortcode for inserting the list into a page
* Elevation profile
  – Interactive path marker
  – Name of the track
  – Distance of the track
  – Maximum/minimum elevation
  – Elevation loss/gain 
  – Trail duration


== Installation ==

**Installation and Settings:**

1. Upload the plugin files to the `/wp-content/plugins/<my-plugin-name>` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the *Plugins* screen in WordPress
3. Use the *Settings->GPX Viewer* screen to configure the plugin at least one time (Measure Units, ...)
4. Accept the link to https://api.open-elevation.com in your browser

**Uploading GPX files:**

* Goto *GPX Files* in the admin menu
* Choose category for repository: Uploaded file will be stored in directory `~/wp-content/uploads/gpx/<mycategory>/`.
* Choose GPX file to upload
* Optionally replace description of track (tag `<name>` in the GPX file)
* Optionally smooth track during upload, i.e. reducing track points and smoothing elevation data
* Optionally replace elevation data using Open-Elevation Service

**Basic usage:**

* Calling the viewer for a specific GPX track:

`    <?php 
        echo gpx_view(array('src'  => $filepath                $filepath = <absolute path>/wp-content/uploads/gpx/<mycategory>/<file>.gpx 
                        [, 'title' => $track_name]
                        [, 'color' => $track_color]
						[, 'width' => $track_width]
						[, 'download_button'=> true/false]));
    ?>
`

* Shortcode to include a GPX track for a given category into a WordPress-page.

    `[gpx-view category="<mycategory>" gpx-file="<filename>"]`

* Shortcode to include the list of the GPX files for a given category into a WordPress-page. From this list a track can be selected and displayed.

    `[gpx-view category="<mycategory>"]`

* Shortcode to open a gpx track locally for editing. The result can be stored again locally.

    `[gpx-view]`

* Shortcode to display the gpx track with given color and/or width.

    `[gpx-view ... color="<rgb-color>" width="<number>"]`

== Screenshots ==

1. Track selected from a file list
2. Editing trackpoints


== Changelog ==

= 2.0.0 =
* Editable trackpoints
* Handling of GPX segments as separated polylines
* Full screen mode using the whole screen

= 2.1.0 =
* Editing trackpoints of locally opened gpx files

= 2.1.1 =
* corrections for editing trackpoints of locally opened gpx files
* correction of missing return value in shortcode function

= 2.1.2 =
* scalebar added to maps

= 2.1.3 =
* In shortcode procedure the function for searching category terms corrected

= 2.1.4 =
* Topographic map view added

= 2.1.5 =
* Error correction: Edited gpx tracks couldn't be updated or stored

= 2.1.6 =
* Error correction: Error when displaying categories in admin screen

= 2.1.7 =
* Error correction: Error when displaying categories in admin and edit screen

= 2.1.8 =
* Code review

= 2.1.9 =
* Enhanced trackpoint reduction for decending slopes

= 2.1.10 =
* Working search function for track list

= 2.1.11 =
* GPX tracks with valid xml schema (gpx.xsd) when exported

= 2.1.12 =
* Showing elevation profile if all elevation values are less than 0

= 2.2.0 =
* MapQuest Elevation Srvice replaced by Open-Elevation Service

= 2.2.1 =
* Shortcode for embedding a single track into a WordPress-page

= 2.2.2 =
* Minor Enhancements

= 2.2.3 =
* Corrections uploading gpx file, writing track name

= 2.2.4 =
* Corrections displaying track name, shortcode with color and width

= 2.2.5 =
* enabling editing of new tracks

= 2.2.6 =
* displaying distances and elevation heights within gpx file lists

= 2.2.7 =
* gpx-viewer works using block (FSE) themes

= 2.2.8 =
* storing new tracks with gpx editor

= 2.2.9
* avoid errors from Open-Elevation when saving edited tracks with single points
