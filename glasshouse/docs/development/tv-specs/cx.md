# LG OLED48CXPUB (2020 — webOS 5)

Hardware profile and low-level diagnostic data gathered from root shell access on an LG OLED48CXPUB running webOS 5.6.2. An OLED65CXPUA on the same firmware reports the identical SoC, CPU, GPU, kernel, memory map, eMMC part and runtimes.

---

## System Overview

| Detail | Value |
|---|---|
| **Model** | OLED48CXPUB (board type `O20_ATSC_US`, OTA id `HE_DTV_W20O_AFABATAA`) |
| **Firmware** | 04.64.00 |
| **webOS** | 5.6.2-21 (codename `jhericurl-jimna`), image `lib32-starfish-atsc-secured` |
| **Kernel** | Linux 4.4.84-219.jcl4tvmr.6 (aarch64, SMP PREEMPT) |
| **Userspace** | 32-bit ARM (`/bin/sh`, `node` and `WebAppMgr` are ELF32) |
| **SoC** | LG1212 / "O20" — Alpha 9 Gen 3 (AArch64) |
| **Chip ID** | `O20B0` (from boot cmdline) |
| **Rooted with** | slopbro |

---

## CPU

| Detail | Value |
|---|---|
| **Architecture** | ARMv8.2-A — Cortex-A55 (CPU part `0xd05`, variant `0x2`; the `atomics` feature flag rules out the Cortex-A73 LG's marketing names for this SoC) |
| **Cores** | 4, all online |
| **Frequency scaling** | Not exposed: no `cpufreq` directory under `/sys/devices/system/cpu/cpu0/` |
| **BogoMIPS** | 100.00 per core |
| **Features** | fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics |

> [!NOTE]
> The CX exposes no cpufreq interface at all, so the clock is neither readable
> nor adjustable from userspace. Voltage is set by LG's AVS system
> (`o20_cpu_avs=3`, `o20_core_avs=3`, `o20_regul=1`).

---

## GPU

| Detail | Value |
|---|---|
| **GPU** | Mali-G51 MP3 (r1p1, ID `0x7090`) |
| **Shader cores** | 3 (core mask `0x7`) |
| **Power policy** | `demand` (available: coarse_demand, always_on) |
| **DVFS period** | 100 ms |
| **Driver** | `mali_kbase` r9p0-01rel0 (UK version 11.0), plus Vivante `galcore` |
| **Framebuffer** | 1920 × 2160 virtual (two 1080p pages) |

---

## Memory

| Detail | Value |
|---|---|
| **Physical RAM** | 3.0 GB: the HMA carve-outs on the cmdline (`hma=856M@0x47800000;360M@0xa9800000`) end at the 3 GB mark |
| **Available to Linux** | 2,618 MB (`MemTotal` 2,680,936 kB) |
| **Swap** | 600 MB zram (`/dev/zram0`) |

---

## Storage

| Detail | Value |
|---|---|
| **Type** | eMMC |
| **Device** | Samsung 8GTF4R |
| **Capacity** | ~7.3 GB (15,269,888 × 512-byte sectors) |
| **Health (life_time)** | `0x01 0x01` (0–10% used) |
| **App store partition** | `/dev/mmcblk0p56` — 2.7 GB (`/mnt/lg/appstore`, `/media`) |
| **Common data** | `/dev/mmcblk0p55` — 722 MB (`/mnt/lg/cmn_data`, `/var`, `/home`) |
| **Database** | `/dev/mmcblk0p54` — 105 MB (`/var/db`) |
| **Root** | `/dev/mmcblk0p27`, squashfs, read-only |

---

## Connectivity

| Detail | Value |
|---|---|
| **Wi-Fi** | MediaTek MT7668 (USB, module `wlan_mt7668_usb`) |
| **Bluetooth** | MediaTek (USB, module `btmtk_usb`) |
| **HDMI** | 4× HDMI 2.1 (`linux_hld_module`) |
| **USB host** | DWC OTG + 4× EHCI + 4× OHCI (9 buses) |
| **Other inputs** | Composite AV |

---

## Software

| Detail | Value |
|---|---|
| **Node.js** | v8.12.0 |
| **Chromium** | 68.0.3440.106 (`WebAppMgr` user agent) |
| **DVB tuners** | Silicon Labs si2178b (ATSC/NTSC), LG SoC demod |

---

## Kernel modules

| Module | Size | Description |
|---|---|---|
| `mali_kbase` | 479 kB | Mali G51 GPU driver |
| `galcore` | 651 kB | Vivante GPU driver |
| `linux_hld_module` | 1.5 MB | Synopsys HDMI/HDCP host library driver |
| `wlan_mt7668_usb` | 2.6 MB | MediaTek MT7668 Wi-Fi |
| `btmtk_usb` | 147 kB | MediaTek Bluetooth |
| `venc_hxenc` | 184 kB | Video encoder |
| `tfat` / `tntfs` | 365 kB / 537 kB | Tuxera FAT and NTFS for USB storage |
| `si2178b` / `atsc_dtv_soc` | — | DVB tuner and SoC demod drivers |
| `webos_tv` | 90 kB | LG webOS platform module |

---

## LG1212 "O20" platform parameters

The `lg1k` kernel module exposes the O20 counterparts of the C2's O22
parameters under `/sys/module/lg1k/parameters/`:

| Parameter | Value | Description |
|---|---|---|
| `o20_cpuNP` | 0 | CPU Normal Performance target |
| `o20_cpuHS` | 0 | CPU High Speed target |
| `o20_gpuNP` | 0 | GPU Normal Performance target |
| `o20_gpuHS` | 0 | GPU High Speed target |
| `o20_cpu_avs` | 3 | CPU Adaptive Voltage Scaling mode |
| `o20_core_avs` | 3 | Core AVS mode |
| `o20_pms_enable` | 1 | Power Management System enabled |
| `o20_pms_tfreq` | 0 | PMS target frequency override |
| `o20_pms_tcorevol` | 0 | PMS target core voltage override |
| `o20_irbs_enable` | 1 | — |
| `o20_regul` | 1 | Voltage regulator active |

The same warning as for the C2 applies: the AVS calibration is per chip
(`o20_avsinfo`), and the override knobs are undocumented.
