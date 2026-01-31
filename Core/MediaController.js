import { MediaStatus } from "./MediaControllerHelpers.js";
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const mprisInterface = `
<node>
    <interface name="org.mpris.MediaPlayer2.Player">
        <method name="PlayPause"/>
        <method name="Next"/>
        <method name="Previous"/>
        <method name="Stop"/>
        <property name="PlaybackStatus" type="s" access="read"/>
        <property name="Metadata" type="a{sv}" access="read"/>
    </interface>
</node>`;

const dBusInterface = `
<node>
    <interface name="org.freedesktop.DBus">
        <method name="ListNames">
            <arg direction="out" type="as"/>
        </method>
        <signal name="NameOwnerChanged">
            <arg direction="out" type="s"/>
            <arg direction="out" type="s"/>
            <arg direction="out" type="s"/>
        </signal>
    </interface>
</node>`;


//proxy constructors
const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(mprisInterface);
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(dBusInterface);

export const MediaController = class MediaController
{
    constructor(playbackChangeCallback)
    {
        this._players = new Map(); // busName -> prox
        this._playerStack = []; // stack - push most recent active payer to the top
        this._dBusProxy = null;
        this._onStatusChange = playbackChangeCallback;
        this._status = MediaStatus.STOPPED;
        this._signalIDs = [];
    }

    startWatching()
    {
        if (this._dBusProxy)
        {
            return;
        }

        this._dBusProxy = new DBusProxy(
            Gio.DBus.session,
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus"
        );

        //Find players that are already running
        const [names] = this._dBusProxy.ListNamesSync();
        names.forEach(name => {
            if (this.shouldAcceptName(name))
            {
                this.setupPlayerProxy(name);
            }
        });

        this._signalIDs.push(
            this._dBusProxy.connectSignal("NameOwnerChanged", (proxy, sender, [name, oldOwner, newOwner]) => {
                if (this.shouldAcceptName(name))
                {
                    if (newOwner && !oldOwner)
                    {
                        this.setupPlayerProxy(name);
                    }
                    else if (!newOwner && oldOwner)
                    {
                        this.removePlayer(name);
                    }
                }
            })
        );

    }

    shouldAcceptName(name)
    {
        return name.startsWith("org.mpris.MediaPlayer2");
    }

    setupPlayerProxy(busName)
    {
        if (this._players.has(busName))
            return;
        
        const proxy = new PlayerProxy(
            Gio.DBus.session,
            busName,
            '/org/mpris/MediaPlayer2'
        );
        
        this._players.set(busName, proxy);
        

        proxy.connect('g-properties-changed', (p) => {
            this.handleStatusChange(busName, p.PlaybackStatus ?? MediaStatus.STOPPED);
        });

        this.handleStatusChange(busName, proxy.PlaybackStatus ?? MediaStatus.STOPPED, proxy);
    }

    handleStatusChange(busName, status, manualProxy = null)
    {
        const proxy = manualProxy || this.getProxy(busName);
        if (!proxy)
            return;

        //Move this player to the top
        const index = this._playerStack.indexOf(busName);
        if (index !== -1)
        {
            this._playerStack.splice(index, 1);
        }

        this._playerStack.unshift(busName);

        //Only display a player that is on the top of the stack
        const activeBus = this._playerStack[0];
        if (busName !== activeBus)
        {
            //We just ignore this one
            return;
        }

        

        let trackInfo = {
            title: "Unknown Title",
            artist: "Unknown Artist",
            artUrl: null,
        };

        const metadataVariant = proxy.get_cached_property('Metadata');
        if (metadataVariant)
        {
            const unpacked = metadataVariant.recursiveUnpack();
            if (unpacked['xesam:title'])
            {
                trackInfo.title = String(unpacked['xesam:title']);
            }

            if (unpacked['xesam:artist'])
            {
                const artist = unpacked['xesam:artist'];
                //can be a list of strings
                trackInfo.artist = Array.isArray(artist) ? artist.join(', ') : String(artist);
            }

            if (unpacked['mpris:artUrl'])
            {
                trackInfo.artUrl = String(unpacked['mpris:artUrl']);
            }
        }

        this._onStatusChange(busName, status, trackInfo);
    }

    removePlayer(busName)
    {
        const index = this._playerStack.indexOf(busName);
        if (index !== -1)
        {
            this._playerStack.splice(index, 1);
        }

        //Get next most recent player from the stack
        const nextBus = this._playerStack[0];
        if (nextBus)
        {
            const proxy = this.getProxy(nextBus);
            this.handleStatusChange(nextBus, proxy.PlaybackStatus ?? MediaStatus.STOPPED, proxy);
        }
        else
        {
            //We don't have any players left
            this._onStatusChange(null, MediaStatus.STOPPED, null);
        }
    }

    getProxy(busName)
    {
        return this._players.get(busName);
    }

    toggleStatus()
    {
        const activeBus = this._playerStack[0];
        if (!activeBus)
        {
            return;
        }

        const proxy = this.getProxy(activeBus);
        if (!proxy)
        {
            return;
        }

        proxy.PlayPauseRemote((result, error) => {
            if (error)
            {
                logError(error);
            }
        });
    }

    goNext()
    {
        const activeBus = this._playerStack[0];
        if (!activeBus)
        {
            return;
        }

        const proxy = this.getProxy(activeBus);
        if (!proxy)
        {
            return;
        }

        proxy.NextRemote((result, error) => {
            if (error)
            {
                logError(error);
            }
        });
    }

    goPrevious()
    {
        const activeBus = this._playerStack[0];
        if (!activeBus)
        {
            return;
        }

        const proxy = this.getProxy(activeBus);
        if (!proxy)
        {
            return;
        }

        proxy.PreviousRemote((result, error) => {
            if (error)
            {
                logError(error);
            }
        });
    }

    destroy()
    {
        for (const id of this._signalIDs)
        {
            this._dBusProxy.disconnect(id);
        }

        this._signalIDs.length = 0;
        this._players.clear();
        this._onStatusChange = null;
        this._dBusProxy = null;
    }
}