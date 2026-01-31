/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import { MediaWidget } from './Core/MediaWidget.js';
import { MediaController } from './Core/MediaController.js';
import { MediaStatus } from './Core/MediaControllerHelpers.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from "gi://GLib";

export default class DockMediaPlayerExtension extends Extension {
    enable() 
    {
        this._mediaWidget = new MediaWidget();
        this._mediaController = new MediaController((busName, newStatus, trackInfo) => {
            this.onMediaStatusChanged(busName, newStatus, trackInfo);
        });

        this._mediaController.startWatching();
        this._mediaWidget.setMediaController(this._mediaController);

        this.insertIntoDash();
    }

    insertIntoDash()
    {
        const existingDash = Main.uiGroup.get_children().find(
            actor => actor.get_name() === 'dashtodockContainer' && actor.constructor.name === 'DashToDock'
        );

        if (existingDash)
        {
            this.attachMediaWidget(existingDash);
        }
        else
        {
            //Wait for the widget to be constructed
            this._dashAddedID = Main.uiGroup.connect('child-added', (_, actor) => {
                if (actor.get_name() === 'dashtodockContainer' && actor.constructor.name === 'DashToDock')
                {
                    Main.uiGroup.disconnect(id);
                    this.attachMediaWidget(actor);
                }
            })
        }
    }

    onMediaStatusChanged(busName, newStatus, trackInfo)
    {
        if (!this._mediaWidget)
            return;

        if (newStatus === MediaStatus.PLAYING || newStatus === MediaStatus.PAUSED)
        {
            if (!trackInfo)
            {
                logError("Track info is null, but media status is playing or paused");
                this._mediaWidget.collapseContainer(() => {});
                
                return;
            }

            this._mediaWidget.expandContainer();
            this._mediaWidget.updateUI(trackInfo, newStatus, busName);
        }
        else
        {
            this._mediaWidget.collapseContainer(() => {});
        }
    }

    attachMediaWidget(dashToDock)
    {
        const dash = dashToDock.dash;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let [minH, natH] = this._mediaWidget.get_preferred_height(-1);
            let artSize = Math.max(32, natH - 16);
            this._mediaWidget._albumCoverArt.set_size(artSize, artSize);
            return GLib.SOURCE_REMOVE;
        })

        dash._box.add_child(this._mediaWidget);
        this._mediaWidget.set_width(0);
        this._mediaWidget.collapseContainer(() => {});
    }

    disable() 
    {
        if (this._dashAddedID) {
            Main.uiGroup.disconnect(this._dashAddedID);
            this._dashAddedID = null;
        }

        this._mediaWidget.collapseContainer(() => {
            if (this._mediaWidget.get_parent())
            {
                this._mediaWidget.get_parent().remove_child(this._mediaWidget);
            }

            this._mediaWidget = null;
        });

        this._mediaController.destroy();
        this._mediaController = null;
    }
}
