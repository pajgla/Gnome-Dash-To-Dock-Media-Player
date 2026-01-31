import { CoverArtHelpers } from "./CoverArtHelpers.js";
import { DefaultColors, StyleClassNames } from "./StyleClassesHelper.js";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';


const TITLE_FALLBACK = "Unknown Title";
const ARTIST_FALLBACK = "Unknown Artist";
const EXPANDED = 'expanded';
const COLLAPSED = 'collapsed';
const TRANSITION_DURATION_MS = 300;

export const MediaWidget = GObject.registerClass(
    class MediaWidget extends St.BoxLayout 
    {
        _init() 
        {
            super._init({
                style_class: StyleClassNames.MediaWidget,
                vertical: true,
                x_expand: true,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.createWidgets();
            this.assembleLayout();
            this.initButtonCallbacks();
        }

        setMediaController(mediaController)
        {
            this._mediaController = mediaController;
        }

        createWidgets() 
        {

            this._mainContainer = new St.BoxLayout({
                style_class: StyleClassNames.MainContainer,
                vertical: false,
                x_expand: false,
                y_expand: false,
            });

            // Widget layout is split into 2 main containers: left (album cover art) and right (metadata and controls)
            
            // ----- RIGHT CONTAINER -----

            // Right container is further split into top (media title) and bottom (further split into left (artist) and right (playback controls))
            this._rightContainer = new St.BoxLayout({
                style_class: StyleClassNames.RightContainer,
                vertical: true,
                x_expand: true,
                y_expand: true,
            });

            //Title at the top of the right container
            this._mediaTitle = new St.Label({
                style_class: StyleClassNames.MediaTitle,
                text: "Unknown Title",
                y_align: Clutter.ActorAlign.START,
                y_expand: true,
                x_expand: false,
            });

            this._mediaTitle.clutter_text.ellipsize = Pango.EllipsizeMode.END;

            //Bottom row of the right container - contains artist name and playback controls
            this._rightContainerBottomRow = new St.BoxLayout({
                style_class: StyleClassNames.RightContainerBottomRow,
                vertical: false,
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.END,
            });

            //Left side of the bottom row - artist name
            this._artistName = new St.Label({
                style_class: StyleClassNames.ArtistLabel,
                text: "Unknown Artist",
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                x_align: Clutter.ActorAlign.START,
            });

            this._artistName.clutter_text.ellipsize = Pango.EllipsizeMode.END;

            // ----- PLAYBACK CONTROLS -----

            //Right side of the bottom row - playback controls
            this._playbackControls = new St.BoxLayout({
                style_class: StyleClassNames.PlaybackControls,
                vertical: false,
                x_expand: false,
                x_align: Clutter.ActorAlign.END,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._previousButton = new St.Button({
                style_class: StyleClassNames.PreviousButton,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._playPauseButton = new St.Button({
                style_class: StyleClassNames.PlayPauseButton,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._nextButton = new St.Button({
                style_class: StyleClassNames.NextButton,
                y_align: Clutter.ActorAlign.CENTER,
            });

            //Playback icons
            this._playIcon = new St.Icon({
                icon_name: "media-playback-start-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._pauseIcon = new St.Icon({
                icon_name: "media-playback-pause-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._previousIcon = new St.Icon({
                icon_name: "media-skip-backward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._nextIcon = new St.Icon({
                icon_name: "media-skip-forward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });


            // ----- LEFT CONTAINER -----

            //Cover art container on the left side of the widget
            this._albumCoverArt = new St.Bin({
                style_class: StyleClassNames.AlbumCoverArt,
                y_align: Clutter.ActorAlign.CENTER,
                clip_to_allocation: true,
            });

            //Used when we cannot fetch cover art (or if none is available)
            this._albumCoverArtFallbackIcon = new St.Icon({
                icon_name: "audio-x-generic-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });
        }

        assembleLayout()
        {
            //Bottom row - artist name on the left, playback controls on the right
            this._rightContainerBottomRow.add_child(this._artistName);
            this._rightContainerBottomRow.add_child(this._playbackControls);

            //Right container - title on top, bottom row below
            this._rightContainer.add_child(this._mediaTitle);
            this._rightContainer.add_child(this._rightContainerBottomRow);

            //Playback control buttons (Changing order here will change their order in the UI)
            this._playbackControls.add_child(this._previousButton);
            this._playbackControls.add_child(this._playPauseButton);
            this._playbackControls.add_child(this._nextButton);

            //Setting icons for playback control buttons
            this._previousButton.set_child(this._previousIcon);
            this._playPauseButton.set_child(this._playIcon);
            this._nextButton.set_child(this._nextIcon);

            //Album cover art fallback - we add the fallback by default, since it will be overriden when we
            //load actual cover art
            this._albumCoverArt.set_child(this._albumCoverArtFallbackIcon);

            //Main widget layout - left (cover art) and right (metadata and controls)
            this._mainContainer.add_child(this._albumCoverArt);
            this._mainContainer.add_child(this._rightContainer);

            //Attach main container to this widget
            this.add_child(this._mainContainer);
        }

        initButtonCallbacks()
        {
            //#TODO: Gray out buttons when playback controls are not available

            this._playPauseButton.connect("clicked", () => {
                this._mediaController.toggleStatus();
            });

            this._nextButton.connect("clicked", () => {
                this._mediaController.goNext();
            });

            this._previousButton.connect("clicked", () => {
                this._mediaController.goPrevious();
            });
        }

        canUsePlaybackControls() 
        {
            //#TODO: Add MPRIS check for CanGoNext, CanGoPrevious...
            return this._mediaController !== null;
        }

        updateUI(metadata, status)
        {
            //#TODO: Animate transition
            //Force string conversion
            this._mediaTitle.set_text(String(metadata.title || TITLE_FALLBACK));
            this._artistName.set_text(String(metadata.artist || ARTIST_FALLBACK));

            if (metadata.artUrl)
            {
                this.setupWidgetStyle(metadata.artUrl).catch(err => {
                    logError(err, "Failed to load album art");
                    this.enableFallbackStyle();
                });
            }
            else
            {
                this.enableFallbackStyle();

                if (this._currentStatus === EXPANDED)
                {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        this.updateContainerWidth();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }

            this.updatePlayPauseButton(status);
        }

        updatePlayPauseButton(status)
        {
            //#TODO: Animate

            if (status === 'Playing')
            {
                this._playPauseButton.set_child(this._pauseIcon);
            }
            else
            {
                this._playPauseButton.set_child(this._playIcon);
            }
        }

        async loadPixbufFromUrl(artUrl)
        {
            let file;
            if (artUrl.startsWith('file://') || artUrl.startsWith('http'))
            {
                file = Gio.File.new_for_uri(artUrl);
            }
            else
            {
                file = Gio.File.new_for_path(artUrl);
            }

            let inputStream;

            try
            {
                inputStream = await new Promise((resolve, reject) => {
                    file.read_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
                        try
                        {
                            resolve(source.read_finish(result));
                        }
                        catch (e)
                        {
                            reject(e);
                        }
                    });
                });

                const pixBuf = await new Promise((resolve, reject) => {
                    GdkPixbuf.Pixbuf.new_from_stream_async(inputStream, null, (source, result) => {
                        try
                        {
                            resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(result));
                        }
                        catch (e)
                        {
                            reject(e);
                        }
                    });
                });

                return { pixBuf, file };
            }
            catch (e)
            {
                logError(e);
            }
        }

        async setupWidgetStyle(artUrl)
        {
            try
            {
                const { pixBuf, file } = await this.loadPixbufFromUrl(artUrl);

                const fileIcon = new Gio.FileIcon({ file: file });
                this._albumCoverArt.set_child(new St.Icon({
                    gicon: fileIcon,
                    y_align: Clutter.ActorAlign.CENTER,
                }));

                this.setTextLabelColors(pixBuf);
            }
            catch (e)
            {
                logError(e, "Failed to load cover art from " + artUrl);
                this.enableFallbackStyle();
            }
        }

        setTextLabelColor(textWidget, color)
        {
            textWidget.set_style(`color: ${color};`);
        }

        setTextLabelColors(pixBuf)
        {
            //#TODO: Animate
            const averageColors = CoverArtHelpers.getAverageRGB(pixBuf);
            
            //Sets background color of the main container (this widget)
            this.set_style(`background-color: rgba(${averageColors[0]}, ${averageColors[1]}, ${averageColors[2]}, 0.5);`);

            const isDark = CoverArtHelpers.isDark(averageColors);
            const mediaNameColor = isDark ? DefaultColors.MediaTitleLight : DefaultColors.MediaTitleDark;
            const artistNameColor = isDark ? DefaultColors.ArtistNameLight : DefaultColors.ArtistNameDark;

            this.setTextLabelColor(this._mediaTitle, mediaNameColor);
            this.setTextLabelColor(this._artistName, artistNameColor);
        }

        enableFallbackStyle()
        {
            this.set_style(`background-color: ${DefaultColors.FallbackBackground};`);
            this._mediaTitle.set_style(`color: ${DefaultColors.MediaTitleLight};`);
            this._artistName.set_style(`color: ${DefaultColors.ArtistNameLight};`);
            this._albumCoverArt.set_child(this._albumCoverArtFallbackIcon);
        }

        //Starts expand animation of the whole widget
        expandContainer()
        {
            if (this._currentStatus === EXPANDED)
                return;

            this.show();
            this._currentStatus = EXPANDED;
            this.remove_all_transitions();

            this.set_width(0);
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.updateContainerWidth();
                return GLib.SOURCE_REMOVE;
            });
        }

        //Starts collapse animation of the whole widget - also calls callback when completed
        collapseContainer(callback)
        {
            if (this._currentStatus === COLLAPSED)
                return;

            this._currentStatus = COLLAPSED;
            this.remove_all_transitions();

            this.ease({
                width: 0,
                opacity: 0,
                duration: TRANSITION_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {

                    //The animation could be intrrupted by another expand call
                    if (this._currentStatus === COLLAPSED)
                    {
                        this.hide();
                    }

                    if (callback && typeof callback === 'function')
                    {
                        callback();
                    }
                },
            })
        }

        //Update the widget width to prefered size once UI info is updated
        updateContainerWidth()
        {
            let currentWidth = this.width;

            //Needed to recalculate prefered width
            this.set_width(-1);

            let [minWidth, naturalWidth] = this.get_preferred_width(-1);

            this.set_width(currentWidth);
            let targetWidth = Math.min(Math.max(naturalWidth, 180), 300);
            this.remove_all_transitions();

            this.ease({
                width: targetWidth,
                opacity: 255,
                duration: TRANSITION_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }
);