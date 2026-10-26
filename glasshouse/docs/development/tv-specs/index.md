# TV Hardware Specifications

Hardware architectures, system-on-chip (SoC) platforms, and low-level specifications across LG webOS TV generations.

---

## Development impact

Hardware specifications directly determine runtime compatibility and performance limits across webOS releases:

- **CPU architecture and binary toolchains**: Older platforms (webOS 3.x–4.4) run a 32-bit ARMv7 (`armv7l`) kernel and userspace. The C9 on webOS 4.10 and webOS 5.x and newer run a 64-bit (`aarch64`) kernel, but the userspace stays 32-bit ARM: on a C9 (webOS 4.10), a CX (webOS 5.6) and a C5 (webOS 10.3), `/bin/sh`, `node` and `WebAppMgr` are all 32-bit ELF binaries. Native daemons, precompiled utilities, and C/C++ tools must target 32-bit ARM on every generation checked so far.
- **Node.js execution environment**: The onboard Node.js runtime varies dramatically by webOS version. webOS 2.x runs Node v0.10 (a 49LF632V: v0.10.25), and webOS 3.x and 4.x Node v0.12 (a C9 on webOS 4.10: v0.12.2; V8 3.x, ES5 only, requiring callbacks and lacking native `Promise`, `async`/`await`, or modern `Buffer` APIs). webOS 5 runs Node v8.12 (CX on webOS 5.6: v8.12.0), and webOS 7 and later run Node v16 or newer with modern ECMAScript support (C5 on webOS 10: v16.20.2).
- **Chromium WebAppMgr rendering**: The WebAppMgr web engine runs Chromium 38 on webOS 3.x and 4.0–4.4, which lacks CSS Grid, modern Flexbox behavior, and ES6 syntax, Chromium 53 on webOS 4.10 (C9), and Chromium 68 on webOS 5. webOS 7 and newer ship Chromium 87+ (webOS 9: 108, webOS 10: 120, webOS 11: 132). LG lists the engine for every release in [Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine); the versions seen on the profiled TVs match it, supporting modern CSS, ECMAScript, and Web APIs.
- **Memory constraints**: Most LG TVs have between 1.5 GB and 3.0 GB of total RAM shared between the system compositor, video decoding pipeline, broadcast middleware, and background services. Most models allocate a 600 MB zram compressed swap device (`/dev/zram0`). Memory leaks or high allocation spikes quickly trigger kernel OOM kills.
- **Hardware diagnostic paths**: Hardware sensors and control interfaces vary by SoC board family (`m16`, `lg1312`, `o20`, `o22`, `o24`). Thermal monitoring paths (`/proc/lg/temp` vs sysfs thermal zones), eMMC wear indicators (`/sys/block/mmcblk0/device/life_time`), and HDMI physical interface diagnostics differ across kernel versions and SoC vendors.

---

## Hardware comparison across generations

The table below summarizes hardware specifications across key LG TV generations tested with the project, spanning webOS 3.x (2016) through webOS 11 (2026, LG's webOS 26). Versions are the ones the TV reports; [webOS version numbers](../../tested-tvs.md#webos-version-numbers) gives LG's names for them.

| Series / Year | webOS (native) | SoC / Board | CPU | GPU | RAM | eMMC | Kernel | Node / Chromium | HDMI |
|---|---|---|---|---|---|---|---|---|---|
| **UH6030 / UH610V** (2016) | webOS 3.0–3.4 | LG M16 / RTD2999 | 4× Cortex-A53 @ 1.0 GHz (ARMv7) | Mali-T760 / T820 | 1.5 GB | 4–8 GB | Linux 3.10 | Node 0.12 / Chr 38 | 3× HDMI 2.0 |
| **B7 / C7** (2017) | webOS 3.5–3.9 | LG M16+ / Alpha 7 pre | 4× Cortex-A53 @ 1.0 GHz (ARMv7) | Mali-T820 MP2 | 2.0 GB | 8 GB | Linux 3.10 / 4.4 | Node 0.12 / Chr 38 | 4× HDMI 2.0 |
| **[B8](b8.md)** (2018) | webOS 4.0–4.4 | Alpha 7 Gen 1 (LG1313) | 4× Cortex-A53 @ 1.0 GHz (ARMv7) | Mali-T820 MP2 | 2.0 GB | 8 GB | Linux 4.4 | Node 0.12 / Chr 38 | 4× HDMI 2.0 |
| **C8** (2018) | webOS 4.0–4.4 | Alpha 9 Gen 1 (LG1312) | 4× Cortex-A53 @ 1.0 GHz (ARMv7) | Mali-G51 MP4 | 2.5 GB | 8 GB | Linux 4.4 | Node 0.12 / Chr 38 | 4× HDMI 2.0 |
| **LM57 / UP80** (2019–21 LCD) | webOS 4.5–6.5 | MediaTek / Realtek | 4× Cortex-A53 @ 1.1 GHz (ARMv7/v8) | Mali-G31 / G52 | 1.5–2.0 GB | 8 GB | Linux 4.9 / 4.19 | Node 8–12 / Chr 68–87 | 2–3× HDMI 2.0 |
| **[C9](c9.md)** (2019) | webOS 4.10 | Alpha 9 Gen 2 (O18) | 4× Cortex-A73 (3 online; no cpufreq exposed) | Mali-G71 MP2 | 2.2 GB to Linux | 8 GB | Linux 4.4 (aarch64) | Node 0.12 / Chr 53 | 4× HDMI 2.1 (48 Gbps) |
| **[CX](cx.md)** / **GX** (2020) | webOS 5.0–5.6 | Alpha 9 Gen 3 (LG1212 / O20) | 4× Cortex-A55 (ARMv8.2-A; no cpufreq exposed) | Mali-G51 MP3 | 3.0 GB (2.6 GB to Linux) | 8 GB | Linux 4.4 | Node 8.12 / Chr 68 | 4× HDMI 2.1 (40 Gbps) |
| **C1 / G1** (2021) | webOS 6.0–6.5 | Alpha 9 Gen 4 (O20 / K7LP) | 4× Cortex-A73 @ 1.2 GHz (ARMv8) | Mali-G52 MP4 | 3.0 GB | 8 GB | Linux 5.4 | Node 12.x / Chr 87 | 4× HDMI 2.1 (40 Gbps) |
| **[C2](c2.md)** / **G2** (2022) | webOS 7.x, updated to 9.x | Alpha 9 Gen 5 (LG1213 / O22) | 4× Cortex-A76 @ 1.4 GHz (ARMv8.2-A) | Mali-G52 MP3 | 2.0–3.0 GB | 8 GB | Linux 5.4 | Node 16.19 / Chr 108 | 4× HDMI 2.1 (48 Gbps) |
| **C3 / G3** (2023) | webOS 8.x, updated to 10.x | Alpha 9 Gen 6 (LG1213+ / O22) | 4× Cortex-A76 @ 1.4 GHz (ARMv8.2-A) | Mali-G52 MP3 | 3.0 GB | 8 GB | Linux 5.4 / 5.15 | Node 18.x / Chr 108+ | 4× HDMI 2.1 (48 Gbps) |
| **B4 / C4** (2024) | webOS 9.x, updated to 10.x | Alpha 8 / Alpha 9 Gen 7 (O24) | 4× Cortex-A76 @ 1.4 GHz (ARMv8.2-A) | Mali-G57 / G52 | 3.0 GB | 8 GB | Linux 5.15 | Node 18.x / Chr 114+ | 4× HDMI 2.1 (144 Hz) |
| **G4 / M4** (2024) | webOS 9.x, updated to 10.x | Alpha 11 (O24Pro) | 4× Cortex-A78 @ 1.6 GHz (ARMv8.2-A) | Mali-G57 MC4 | 4.0 GB | 16 GB | Linux 5.15 / 6.1 | Node 20.x / Chr 120+ | 4× HDMI 2.1 (144 Hz) |
| **[C5](c5.md)** (2025) | webOS 10.x | Alpha 9 Gen 8 (LG1213 / O22A3) | 4× Cortex-A76 @ 1.4 GHz (ARMv8.2-A) | Mali-G52 MP3 | 2.5 GB (2.0 GB to Linux) | 16 GB | Linux 5.4 | Node 16.20 / Chr 120 | 4× HDMI 2.1 (144 Hz) |
| **G5** (2025) | webOS 10.x / 11.x | Alpha 11 Gen 2 | Quad-core ARMv8.2-A (ARMv8) | Mali-G57 / Immortalis | 4.0 GB | 16 GB | Linux 6.1+ | Node 20+ / Chr 120+ | 4× HDMI 2.1 (144 Hz) |
| **[UA73](ua73.md)** (2025 LCD) | webOS 10.x | Realtek K25LP (RTD2875q) | 4× Cortex-A73 @ 1.24 GHz (ARMv8-A) | PowerVR Rogue (`rgx_merlin9`) | 2.0 GB (1.7 GB to Linux) | 8 GB | Linux 5.4 | Node 16.20 / Chr 120 | 3× HDMI (4K@60, eARC) |
| **[NU80](nu80.md)** (2026 LCD) | webOS 11.x | Realtek K25Lpn | 4× Cortex-A73 @ 1.24 GHz (ARMv8-A) | PowerVR CXM-2-64 | ~1.5 GB (1.2 GB to Linux) | 8 GB | Linux 6.12 | Node 20.12 / — | — |

---

## Verified hardware profiles

Detailed diagnostic scrapes gathered directly from live hardware via root shells:

- [LG OLED65B8SLC (2018 — webOS 4)](b8.md): Alpha 7 Gen 1 (LG1313 rev.C0), 4× Cortex-A53 @ 1.0 GHz, Mali-T820 MP2, Node v0.12.2, Chromium 38, Linux 4.4.
- [LG OLED65C97LA (2019 — webOS 4.10)](c9.md): Alpha 9 Gen 2 ("O18"), 4× Cortex-A73, Mali-G71 MP2, Node v0.12.2, Chromium 53, Linux 4.4 (aarch64).
- [LG OLED48CXPUB (2020 — webOS 5)](cx.md): Alpha 9 Gen 3 (LG1212 / "O20"), 4× Cortex-A55, Mali-G51 MP3, Node v8.12.0, Chromium 68, Linux 4.4.
- [LG OLED42C24LA (2022 — webOS 6/9)](c2.md): Alpha 9 Gen 5 (LG1213 / "O22"), 4× Cortex-A76 @ 1.4 GHz, Mali-G52 MP3, Node v16.19.1, Chromium 108, Linux 5.4.
- [LG OLED48C5PUA (2025 — webOS 10)](c5.md): Alpha 9 Gen 8 (LG1213 / "O22"), 4× Cortex-A76 @ 1.4 GHz, Mali-G52 MP3, Node v16.20.2, Chromium 120, Linux 5.4.
- [LG 55UA73006LA (2025 — webOS 10)](ua73.md): Realtek RTD2875q / "K25LP", 4× Cortex-A73 @ 1.24 GHz, PowerVR Rogue (`rgx_merlin9`, BVNC 46.72.102.389), Node v16.20.2, Chromium 120, Linux 5.4.
- [LG 43NU800BPSC (2026 — webOS 11)](nu80.md): Realtek K25Lpn, 4× Cortex-A73 @ 1.24 GHz, PowerVR GPU, Node v20.12.2, Linux 6.12.

### Generational leap: B8 vs C2

Comparing live scrapes of the B8 (2018) and C2 (2022) highlights several major platform shifts:

- **CPU performance**: Moving from Cortex-A53 to Cortex-A76 yields roughly 3× instructions-per-clock (IPC) improvement, combined with a 40% clock frequency increase (1.0 GHz to 1.4 GHz). Single-threaded execution is approximately 4× faster.
- **GPU architecture**: The Mali-T820 MP2 (Midgard) moves to the Mali-G52 MP3 (Bifrost), delivering roughly 3× higher shader throughput and modern GLES support.
- **V8 JavaScript runtime**: Node.js v0.12 to v16.19 brings full modern ES6+ support, async/await, and a much faster V8 engine. Chromium 38 to 108 enables modern CSS layout and web standards.
- **Frequency governors**: The B8 utilizes a standard two-step DVFS table (600 MHz and 1008 MHz). The C2 locks the CPU to a single 1400 MHz OPP and handles power management through LG's proprietary Adaptive Voltage Scaling (AVS) subsystem (`o22_cpu_avs=2`).

---

## Contributing a hardware profile

Hardware scrapes from additional models help map platform differences, driver parameters, and sysfs interfaces.

### 1. Collect diagnostic data

On a rooted TV with an active SSH or Telnet shell session, run the following diagnostic commands:

```sh
echo "=== System and Kernel ==="
uname -a
cat /proc/version
cat /etc/webos-release 2>/dev/null

echo "=== System Properties ==="
luna-send -n 1 -f 'luna://com.webos.service.tv.systemproperty/getSystemInfo' \
  '{"keys":["modelName","firmwareVersion","sdkVersion","boardType","chipId"]}' 2>/dev/null

echo "=== CPU Information ==="
cat /proc/cpuinfo
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_available_frequencies 2>/dev/null
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver 2>/dev/null

echo "=== Memory and Swap ==="
free -m
cat /proc/swaps

echo "=== Storage and eMMC Health ==="
cat /sys/block/mmcblk0/device/name 2>/dev/null
cat /sys/block/mmcblk0/device/life_time 2>/dev/null
df -h

echo "=== GPU and Kernel Modules ==="
lsmod

echo "=== Runtimes ==="
node -v 2>/dev/null
```

### 2. Submit the profile

To contribute the data:

1. Create a markdown profile following the format of [LG B8](b8.md) or [LG C2](c2.md).
2. Save the file under `docs/development/tv-specs/<model-slug>.md` (for example, `c4.md` or `g3.md`).
3. Add the page to `mkdocs.yml` under `Development > TV hardware specifications` and link it in the table above.
4. Submit a pull request on GitHub or share the command output in an issue or discussion.
