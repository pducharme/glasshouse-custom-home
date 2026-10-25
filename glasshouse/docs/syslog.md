# Log forwarding (syslog)

Glasshouse can send the logs shown on the [Tools tab](dashboard/tools.md) to a log server on the local network, so they can be kept and searched alongside the logs of other devices.

This is for networks that already run a log server, such as Grafana Loki (through Alloy), rsyslog, syslog-ng or Vector. Without one, there is nothing to set up: the Tools tab shows the logs on its own.

## Checking it

The Tools tab says under its title whether the logs are also being sent, and if so, where, which logs, whether personal details are removed, and how many lines have been sent.

## Setting it up

Log forwarding is set up in `/var/lib/tvweb/config.json` on the TV, followed by a restart of the server:

```json
"syslog": {
  "server": "logs.lan",
  "port": 514,
  "hostname": "",
  "sources": ["system", "glasshouse"],
  "redact": true
}
```

* **server**: the log server's name or address. Empty turns forwarding off.
* **port**: where it listens, 514 unless it says otherwise.
* **hostname**: the name the TV's lines arrive under. Empty uses the TV's device name.
* **sources**: which logs to send. `system` is the TV's own log, `glasshouse` is Glasshouse's, and `kernel` is the TV's kernel log, which means reading it every 30 seconds, so it is off unless listed.
* **redact**: removes addresses, credentials and postcodes, as the Tools tab's copy and export do. The TV's own logs include the owner's postcode, so this stays on unless there is a reason to turn it off.

Lines go as standard syslog (RFC 5424) over UDP, one line each. With Alloy, `loki.source.syslog` with `syslog_format = "rfc5424"` takes them.

UDP syslog is not encrypted or authenticated, and anything on the network path can read it. [Security](SECURITY.md) and [Internals](IMPLEMENTATION.md#forwarding-the-logs-to-syslog) have the details.
