# Telemetry and diagnostics

The **Metrics** tab, `/?tab=metrics`, exposes information about what the TV is doing and what hardware it contains — most of which is absent from its own settings menu.

This is useful both for monitoring and for troubleshooting. It shows whether a high-temperature condition is accompanied by CPU load, what Wi-Fi signal the TV actually has, what HDMI mode a connected device negotiated, and what software is currently running.

* SoC temperature, CPU and per-core load, GPU clock, memory and swap, Wi-Fi RSSI and network throughput.
* The TV's IPv4 address on the home network, with its DNS name under it where the network's DNS has a reverse entry for it.
* eMMC flash wear with JEDEC health translation, and free space on the app partition.
* Visual HDMI port bay showing physical connection state, eARC designation, connected device name, active resolution and refresh rate, link speed (such as FRL 48 Gbps or TMDS), chroma format, color depth, HDCP version, and gaming flags (VRR, ALLM, QMS).
* The source's HDR format (SDR, HDR10, HLG, Dolby Vision, or player-led Dolby Vision as "Dolby Vision (low latency)"), picture mode, OLED light level, the raw HDMI signal (`3840x2160 @ 120Hz`), audio output routing, and the running app with friendly input names (`Apple TV (HDMI2)`).
* Magic Remote battery (webOS 4, 9 and 10), live Bluetooth connection status (Connected / Standby status pill), signal strength, model, and firmware version, with persistence across restarts; webOS and firmware version, SoC architecture, OLED cell ID and TCON firmware where the platform exposes them.
* On demand: what is resident in memory, and which processes are using the processor right now. Each process is listed with its pid, the number the TV's logs name it by.

![Metrics tab: processor, memory, swap and network readouts](https://raw.githubusercontent.com/rorygallagher2024/glasshouse/859f5e134e0d9d4b499afe48084b9cdb82db9164/docs/screenshots/metrics-system.png)

*Metrics including processor, memory, swap and network.*

## Watch time

![Watch time: today, 7 days and 30 days, a bar for each of the last 14 days, and the time per app and input](https://raw.githubusercontent.com/rorygallagher2024/glasshouse/859f5e134e0d9d4b499afe48084b9cdb82db9164/docs/screenshots/metrics-watch-time.png)

Shown while **Watch time** is on in the [Server tab](server.md#glasshouse). It
is off until then, as it records what the household watches. While on, the
server counts how long the screen is on with each app or input in front, and
the time the TV is on with its panel off, such as music, apart as **Screen
off**, and the time LG's screen saver shows apart as **Screen saver**. Neither
counts in the totals or the bars. The card shows today, the last 7 days and the last 30 days, a bar for
each of the last 14 days with the five most watched apps and inputs over 30
days, and the time for each of them. It updates every 30 seconds while the tab
is open.

The days are the viewing browser's own. The history stays on the TV, in
`/var/lib/tvweb/history`, for 13 months. Switching watch time off keeps what is
there and counts no more. With it on, Home Assistant gets [three watch-time sensors](../HOME-ASSISTANT-ENTITIES.md#hardware-remote-system-diagnostics)
and Prometheus `glasshouse_watch_seconds_total`.

Time is counted while the server runs, so a TV switched off at the wall or
before the server has started is not counted, and a power cut loses up to the
last 10 minutes.
