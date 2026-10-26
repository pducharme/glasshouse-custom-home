# Prometheus metrics

[Prometheus](https://prometheus.io/) is an open-source time-series monitoring and alerting platform. Rather than waiting for systems to push events, Prometheus periodically scrapes metrics over HTTP from instrumented endpoints, storing timestamped samples that can be queried with PromQL and visualized in dashboards like [Grafana](https://grafana.com/).

In Glasshouse, the Prometheus metrics endpoint exposes your TV's system, panel, and HDMI telemetry directly to Prometheus-compatible scrapers (including VictoriaMetrics and Grafana Agent). Common use-cases include:

* **Long-term OLED panel and storage health:** Graphing panel run-time against automatic pixel refresher cycles in Grafana to monitor panel aging, verify that compensation cycles run after prolonged sessions, and track eMMC flash wear over the life of the TV.
* **Thermal and hardware observability:** Recording SoC temperatures, processor clocks, and memory utilization over time to identify thermal throttling, background spikes, or resource constraints during high-bitrate 4K HDR playback and gaming.
* **Proactive home lab alerting:** Setting Alertmanager alert rules to trigger notifications when Magic Remote battery levels drop below 15%, when internal storage approaches capacity, when eMMC enters pre-EOL warning states, or if panel maintenance errors occur.
* **Infrastructure monitoring without Home Assistant:** Collecting rich telemetry directly into an existing monitoring and observability stack without requiring an MQTT broker or Home Assistant instance.

The server answers scrapes at `/api/prometheus/metrics` in the standard Prometheus text exposition format. It is off by default, and while it is off the path does not exist: a request receives a `404 Not Found`.

## Switching it on

The **Prometheus** switch on the [Server tab](dashboard/server.md) turns it on and off, at once and without a restart. It is read-only where controls are turned off in `config.json`.

The same setting can be configured in `/var/lib/tvweb/config.json` on the TV, followed by a restart of the server:

```json
"prometheus": { "enabled": true }
```

## Scraping

The endpoint is under `/api/`, so a [token](SECURITY.md), where one is set, is needed as for the rest of the API. Prometheus sends it as an `Authorization: Bearer` header, which keeps it out of URLs and logs:

```yaml
scrape_configs:
  - job_name: glasshouse
    metrics_path: /api/prometheus/metrics
    scrape_interval: 15s
    authorization:
      credentials_file: /etc/prometheus/glasshouse-token
    static_configs:
      - targets: ["192.168.1.20:8080"]
```

Each scrape runs the same stats collection as the dashboard, behind its 1.5 s cache, so 15 s is the recommended minimum scrape interval. At that rate it costs about the same as the MQTT bridge's 10 s publish.

## Testing locally

To spin up a local Prometheus instance against your TV without manual setup:

```bash
./scripts/run-prometheus.sh <tv-ip> [<tv-ip2> ...]
```

It downloads a standalone Prometheus binary into `~/.cache/glasshouse-prometheus/` if one is not in PATH, starts a server targeting your TV(s) at `http://localhost:9090`, and cleans up its temporary state when stopped.

## Metrics

These names are stable: one is not renamed or removed, so dashboards and alerts built on them keep working. Labels carry only values that rarely change. Values are in base units: bytes, hertz, seconds, and ratios from 0 to 1 rather than percentages. A family the TV gives no reading for, such as the panel figures on an LCD or the remote's battery with no remote paired, is left out of the scrape, HELP and TYPE too, rather than given a 0.

The OLED protections are `asbl`, the Automatic Static Brightness Limiter (Temporal Peak Control on the TV), which lowers brightness while a bright image is held, and `gsr`, Global Stress Reduction, which dims the screen when it detects a stationary element. They come from the TV's panel service, or from its panel maintenance records where it has none; a TV that reports neither has no sample for them.

`glasshouse_signal_info` labels the picture settings in use: `dynamic_range` is `sdr`, `hdr`, `dolby_vision` or `technicolor`, and `picture_mode` is the mode within it: `personalized`, `vivid`, `standard`, `eco`, `cinema`, `cinema_bright`, `sports`, `game`, `photo`, `filmmaker`, `expert_bright`, `expert_dark` or `hdr_effect`. A value the TV adds later keeps its own name in snake case.

`glasshouse_sound_info` labels the sound settings, the output and mode the dashboard's and Home Assistant's selects show, rather than the audio path in use at the moment. `output` is the output's key, such as `tv_speaker`, `external_arc`, `external_optical`, `bt_soundbar`, `headphone`, or `tv_external_speaker`, and `mode` is `standard`, `ai_sound`, `ai_sound_plus`, `movie`, `news`, `sports`, `music`, or `game`. A value the TV adds later keeps its own name in snake case. `glasshouse_sound_input_info` labels the format of the sound being played, from an app or an input: `codec` is the TV's name for it, such as `pcm`, `opus`, `aac`, `ac3`, `eac3`, or `truehd`, and `immersive` is `dolby_atmos`, `dts_x`, or `none`. It has a sample only while something plays, and not at all on webOS 4, which does not report it. `glasshouse_volume_ratio` has a sample only while the TV sets the volume level: with an output whose volume it only steps, such as an ARC soundbar, or does not control, such as optical, it has no level to report.

`glasshouse_power_on_info` labels the reason the TV's power service gives for the TV last powering on, read at Glasshouse's start and after each power transition. `reason` is the service's own name in snake case, as in its `PowerOnReason` log lines, such as `remote_key`, `wake_on_wifi`, `always_on`, or `reboot_by_on_regular`, and the family has no sample on a TV that gives none. `glasshouse_power_on_time_seconds` is when the TV last powered on, from the time on its power service reports, and has no sample in standby; the time it has been on is `time() - glasshouse_power_on_time_seconds`.

The signal gauges describe the HDMI source on screen and have no sample otherwise. The refresh rate is the rate the source sends, not the content's frame rate. `glasshouse_signal_frame_rate_hertz` is the rate the game is running at while VRR is in use, and the same as the refresh rate otherwise. Its `vrr_type` label is the kind of VRR, such as `gsync`, or `off`.

`glasshouse_signal_format_info` and the HDR families describe the source on the TV's connected video sink and have no sample without one. `type` is the source's HDR type, such as `sdr` or `hdr10`, with player-led (low-latency) Dolby Vision as `dolby_vision_low_latency`; `eotf` is `sdr`, `hdr`, `pq`, or `hlg`, from the source's HDR static metadata, and empty without it; `colorimetry` is the colorimetry the source signals, such as `bt2020_rgb_or_ycbcr`; and `encoding` is `rgb_444`, `ycbcr_444`, `ycbcr_422`, or `ycbcr_420`, named as the HDMI link's `chroma` is. A value the TV adds later keeps its own name in snake case. The HDR luminance gauges are in nits (cd/m²), from HDR10 static metadata, and the content and frame-average light levels have no sample while the source gives none.

`glasshouse_signal_low_latency` is ALLM, the flag an HDMI source sets to ask for the TV's low-latency picture processing, in any format. Low-latency Dolby Vision is separate: the source does the Dolby Vision mapping and sends a BT.2020 signal, and `type` is `dolby_vision_low_latency`, where Dolby Vision the TV maps is `dolby_vision`. `dynamic_range` is `dolby_vision` in both, so only `type` tells them apart, and neither implies ALLM.

The HDMI link families describe every input with a source linked to it, whichever input is on screen, and have no sample for an input without one; `glasshouse_hdmi_source_powered` has a sample for every input, linked or not. `input` is `hdmi1` to `hdmi4`, as the TV numbers its inputs. `phy_mode` is `frl_48`, `frl_40`, `frl_32`, `frl_24`, `frl_18`, `frl_9`, `tmds_6g`, or `tmds_3g`, and `other` for a mode outside these, which has no rate; `chroma` is `rgb_444`, `ycbcr_444`, `ycbcr_422`, or `ycbcr_420`; and `hdcp` is `2_3`, `2_2`, `1_4`, or `none`. A chroma format or HDCP version outside these keeps its own name in snake case.

`glasshouse_foreground_app_info` has a sample while an app is in the foreground, including with the screen off, and none in standby: `app_id` is the app's id, such as `com.webos.app.hdmi4` or `netflix`, and `app_name` is the name given an input in the TV's settings, an app's title, or the short id. `glasshouse_hdmi_input_info` has a sample for every HDMI input, labelled with `input`, its `app_id`, and the `name` given it in the TV's settings, so the foreground app joins it on `app_id` and the input then joins the HDMI link families on `input`.

The syslog counters count since the server started and have samples only while [syslog forwarding](IMPLEMENTATION.md#forwarding-the-logs-to-syslog) is on. `source` is `system`, `glasshouse`, or `kernel`, one for each source forwarded. Compared with what the receiver counts per `source` as MSGID, they show lines lost on the way.

The NTP families have samples only while [setting the clock from NTP](IMPLEMENTATION.md#setting-the-clock-from-ntp) is on, and the offset, round trip, stratum, and last answer only once the server has answered. The counters count since the server started. The offset is the server's time less the TV's at that answer, before the clock was set from it. How long since the last answer is `time() - glasshouse_ntp_last_answer_timestamp_seconds`.

`glasshouse_watch_seconds_total` has samples only while [watch time](dashboard/metrics.md#watch-time) is on, one for each `app` the history has: the app's id, the input's, such as `hdmi2`, `screen_off` for the TV on with its panel off, or `screen_saver` for LG's screen saver showing. Clearing the history resets it.

`version` is the Glasshouse version. A label the TV does not report is present with an empty value. The panel usage since the last compensation cycle is `glasshouse_oled_panel_usage_seconds_total - glasshouse_oled_last_compensation_usage_seconds`, the uptime is `time() - glasshouse_boot_time_seconds`, and the processor's busy share is `1 - avg without (cpu, mode) (rate(glasshouse_cpu_seconds_total{mode="idle"}[5m]))`.

| Metric                                            | Type    | Labels                                  | Value                                                       |
| :------------------------------------------------ | :------ | :-------------------------------------- | :---------------------------------------------------------- |
| `glasshouse_info`                                 | gauge   | `model`, `firmware`, `webos`, `version` | 1                                                           |
| `glasshouse_boot_time_seconds`                    | gauge   |                                         | When the TV last booted, as a Unix time; later than the real boot on a TV that suspends in standby |
| `glasshouse_system_on`                            | gauge   |                                         | 1 when on, including with the screen off                    |
| `glasshouse_screen_on`                            | gauge   |                                         | 1 when the screen is on, including a screen saver           |
| `glasshouse_power_on_info`                        | gauge   | `reason`                                | 1                                                           |
| `glasshouse_power_on_time_seconds`                | gauge   |                                         | When the TV last powered on, as a Unix time; none in standby |
| `glasshouse_soc_temperature_celsius`              | gauge   |                                         | SoC temperature                                             |
| `glasshouse_cpu_seconds_total`                    | counter | `cpu`, `mode`                           | Time each online core has spent in each mode                |
| `glasshouse_cpu_frequency_hertz`                  | gauge   |                                         | Processor clock                                             |
| `glasshouse_gpu_frequency_hertz`                  | gauge   |                                         | GPU clock                                                   |
| `glasshouse_memory_total_bytes`                   | gauge   |                                         | `MemTotal`                                                  |
| `glasshouse_memory_available_bytes`               | gauge   |                                         | `MemAvailable`                                              |
| `glasshouse_swap_total_bytes`                     | gauge   |                                         | `SwapTotal`                                                 |
| `glasshouse_swap_free_bytes`                      | gauge   |                                         | `SwapFree`                                                  |
| `glasshouse_network_receive_bytes_total`          | counter | `interface`                             | Bytes received on the interface in use                      |
| `glasshouse_network_transmit_bytes_total`         | counter | `interface`                             | Bytes sent on the interface in use                          |
| `glasshouse_wifi_signal_dbm`                      | gauge   |                                         | Wi-Fi signal level                                          |
| `glasshouse_wifi_link_quality`                    | gauge   |                                         | Wi-Fi link quality, on the driver's own scale               |
| `glasshouse_emmc_pre_eol_state`                   | gauge   | `state`                                 | 1 for the current eMMC state: `normal`, `warning`, `urgent` |
| `glasshouse_emmc_life_used_ratio`                 | gauge   | `type`                                  | eMMC estimated life used, in steps of 0.1                   |
| `glasshouse_app_storage_size_bytes`               | gauge   |                                         | Size of the app storage filesystem                          |
| `glasshouse_app_storage_available_bytes`          | gauge   |                                         | Space available there for new apps                          |
| `glasshouse_remote_battery_ratio`                 | gauge   |                                         | Magic Remote battery, read from the remote over Bluetooth   |
| `glasshouse_adblock_enabled`                      | gauge   |                                         | 1 when ad blocking is in place                              |
| `glasshouse_oled_panel_usage_seconds_total`       | counter |                                         | Time the panel has been in use                              |
| `glasshouse_oled_last_compensation_usage_seconds` | gauge   |                                         | Panel usage at the last short compensation cycle            |
| `glasshouse_oled_compensation_interval_seconds`   | gauge   |                                         | Panel usage between short compensation cycles               |
| `glasshouse_oled_compensation_running`            | gauge   |                                         | 1 while a short compensation cycle runs                     |
| `glasshouse_oled_compensation_runs_total`         | counter |                                         | Short compensation cycles completed                         |
| `glasshouse_oled_last_refresher_usage_seconds`    | gauge   |                                         | Panel usage at the last Pixel Refresher run                 |
| `glasshouse_oled_refresher_interval_seconds`      | gauge   |                                         | Panel usage between automatic Pixel Refresher runs          |
| `glasshouse_oled_refresher_runs_total`            | counter |                                         | Pixel Refresher runs completed                              |
| `glasshouse_oled_refresher_running`               | gauge   |                                         | 1 while a Pixel Refresher run is in progress                |
| `glasshouse_oled_refresher_scheduled`             | gauge   |                                         | 1 while a Pixel Refresher run waits for the next standby    |
| `glasshouse_oled_failure_alerts_total`            | counter |                                         | Panel maintenance failure alerts recorded                   |
| `glasshouse_oled_gsr_stress_events_total`         | counter |                                         | Stress events Global Stress Reduction has counted           |
| `glasshouse_oled_protection_enabled`              | gauge   | `protection`                            | 1 when the protection is on: `asbl`, `gsr`                  |
| `glasshouse_picture_backlight_ratio`              | gauge   |                                         | Backlight of the picture mode in use, OLED light on an OLED |
| `glasshouse_sound_info`                           | gauge   | `output`, `mode`                        | 1                                                           |
| `glasshouse_sound_input_info`                     | gauge   | `codec`, `immersive`                    | 1 while something plays                                     |
| `glasshouse_volume_ratio`                         | gauge   |                                         | Volume, while the TV sets the level                         |
| `glasshouse_muted`                                | gauge   |                                         | 1 while the sound is muted                                  |
| `glasshouse_foreground_app_info`                  | gauge   | `app_id`, `app_name`                    | 1                                                           |
| `glasshouse_signal_info`                          | gauge   | `dynamic_range`, `picture_mode`         | 1                                                           |
| `glasshouse_signal_low_latency`                   | gauge   |                                         | 1 while the picture is in low-latency mode (ALLM)           |
| `glasshouse_signal_vrr`                           | gauge   |                                         | 1 while the HDMI source uses VRR                            |
| `glasshouse_signal_width_pixels`                  | gauge   |                                         | Width of the HDMI source's picture                          |
| `glasshouse_signal_height_pixels`                 | gauge   |                                         | Height of the HDMI source's picture                         |
| `glasshouse_signal_refresh_hertz`                 | gauge   |                                         | Refresh rate of the HDMI signal                             |
| `glasshouse_signal_frame_rate_hertz`              | gauge   | `vrr_type`                              | Frame rate the HDMI source presents                         |
| `glasshouse_signal_format_info`                   | gauge   | `type`, `eotf`, `colorimetry`, `encoding` | 1                                                         |
| `glasshouse_signal_hdr_mastering_luminance_max_nits` | gauge | | Peak luminance of the mastering display |
| `glasshouse_signal_hdr_mastering_luminance_min_nits` | gauge | | Black level of the mastering display |
| `glasshouse_signal_hdr_content_light_level_max_nits` | gauge | | Brightest pixel in the content (MaxCLL) |
| `glasshouse_signal_hdr_frame_average_light_level_max_nits` | gauge | | Brightest frame average in the content (MaxFALL) |
| `glasshouse_signal_game_mode`                     | gauge   |                                         | 1 while the source is in game mode                          |
| `glasshouse_hdmi_input_info`                      | gauge   | `input`, `app_id`, `name`               | 1                                                           |
| `glasshouse_hdmi_link_info`                       | gauge   | `input`, `phy_mode`, `chroma`, `hdcp`   | 1                                                           |
| `glasshouse_hdmi_link_bits_per_second`            | gauge   | `input`                                 | Rate of the input's link                                    |
| `glasshouse_hdmi_qms`                             | gauge   | `input`                                 | 1 while Quick Media Switching is active on the link         |
| `glasshouse_hdmi_source_powered`                  | gauge   | `input`                                 | 1 while a powered source is on the input's cable            |
| `glasshouse_syslog_messages_total`                | counter | `source`                                | Log lines sent to the syslog server                         |
| `glasshouse_syslog_errors_total`                  | counter |                                         | Log lines that could not be sent, and were dropped          |
| `glasshouse_ntp_clock_sets_total`                 | counter |                                         | Times the clock was set from the NTP server                 |
| `glasshouse_ntp_errors_total`                     | counter |                                         | NTP syncs that set no clock                                 |
| `glasshouse_ntp_offset_seconds`                   | gauge   |                                         | The server's time less the TV's at the last answer          |
| `glasshouse_ntp_round_trip_seconds`               | gauge   |                                         | Round trip to the server for the last answer                |
| `glasshouse_ntp_stratum`                          | gauge   |                                         | The server's stratum in the last answer                     |
| `glasshouse_ntp_last_answer_timestamp_seconds`    | gauge   |                                         | When the last answer came, as a Unix time                   |
| `glasshouse_watch_seconds_total`                  | counter | `app`                                   | Time the TV was on with the app or input in front           |
