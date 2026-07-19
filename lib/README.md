# coreliquid-control 

A Rust library for controlling MSI MEG/MPG Coreliquid AIO coolers over USB HID.
It sets fan and pump curves, pushes temperature, and reads status, all without
MSI Center running.

The protocol was reverse-engineered from USB captures of MSI Center, so the code
follows what the hardware actually accepts. Unofficial and early-stage. Not
affiliated with MSI.

## Layout

```
src/
├── lib.rs           crate root: module wiring and public exports
├── error.rs         the shared error type
├── protocol.rs      on-wire report format, fan curves, configuration
├── cooler.rs        opening a device and applying or reading profiles
├── models/
│   ├── mod.rs       model registry and device detection
│   ├── s280.rs      MEG Coreliquid S280 spec
│   ├── s360.rs      MEG Coreliquid S360 spec
│   └── k360.rs      MPG Coreliquid K360 spec
└── bin/
    ├── test_profile.rs   applies a fixed test profile
    ├── dump_profile.rs   hex-dumps the config replies and the parsed profile
    └── list_devices.rs   lists the HID interfaces hidapi can see
```

## What each piece does

### protocol.rs

The wire format lives here: the 64-byte report structure, the command bytes,
and the five channel slots. Two public types carry most of the weight.

`ChannelCurve` is a single fan curve, built with
`ChannelCurve::try_from_points(&[(temp, duty), ...])`. A curve takes between
`MIN_CURVE_POINTS` (4) and `MAX_CURVE_POINTS` (7) points, with non-zero,
strictly increasing temperatures. Anything outside those bounds is rejected at
construction, because the firmware rejects it too, so every curve that exists
is valid. `points()` returns a curve's pairs zero-padded to seven entries;
`point_count()` says how many of them are real.

`FanConfig` holds the curves for every channel (radiator fans, waterblock fan,
pump) and serializes them into the two reports the device expects. The reverse
direction lives here too: the parser behind `Cooler::read_profile` turns the
device's configuration replies back into a `FanConfig`. `FanStatus` and the
status parser also live here: one status reply carries the current speed (RPM)
and duty (%) of every channel. The speed offsets were confirmed against the
S280 capture; the duty and configuration slot offsets match liquidctl's driver
for the same cooler family.

### cooler.rs

`Cooler` is the public entry point. Consumers scan, open, and drive the device
through it; the other modules back it and stay internal. It provides:

- `Cooler::scan()` to list the attached models without opening anything, and
  `Cooler::known_models()` to list every model the library recognizes
- `Cooler::open(spec)` to open a scanned model, or `Cooler::detect()` to scan
  and open the first match in one call
- `initialize()` to run the connect handshake the device expects before control
- `new_config()` to get a `FanConfig` seeded with safe defaults
- `read_profile()` to read the profile the device is currently running
  (`None` when no custom curve is applied), which also seeds
  `current_profile()`
- `apply_config(&config)` to write a profile
- `push_cpu_temp(temp)` to feed the device a temperature so it evaluates curves
- `status()` to read the current speed and duty of every channel
- `dump_config_replies()` to hex-dump the raw configuration replies, for
  verifying the read-back layout on new hardware

### models/

The internal registry behind `Cooler::scan()` and `Cooler::known_models()`.
Each supported cooler is a small file exposing one `SPEC` constant: its USB
product ID, display name, and radiator fan count. `mod.rs` gathers those into
a registry. Adding a cooler is a new file plus one line in the registry array,
with no other code touched.

### error.rs

`ControllerError`, the single error type every fallible call returns.

### bin/

`test_profile` applies a fixed profile and is handy for confirming the hardware
responds. `dump_profile` hex-dumps the raw configuration replies next to the
profile parsed from them, for checking the read-back layout against real
hardware. `list_devices` is a read-only diagnostic that prints every MSI HID
interface hidapi enumerates, useful when a cooler is not being detected.

## Usage

```rust
use coreliquid::{ChannelCurve, Cooler};

let mut cooler = Cooler::detect()?;
cooler.initialize()?;

// Show what the device is running now, or fall back to fresh defaults.
let mut config = match cooler.read_profile()? {
    Some(running) => running,
    None => cooler.new_config(),
};
config.set_radiators(ChannelCurve::try_from_points(&[(35, 30), (50, 55), (65, 80), (80, 100)])?);
config.set_pump(ChannelCurve::try_from_points(&[(30, 80), (45, 85), (60, 95), (75, 100)])?);
cooler.apply_config(&config)?;
```

To present a device picker instead of grabbing the first match, call
`Cooler::scan()` and pass the chosen `ModelSpec` to `Cooler::open`.

## Building

```
cargo build
cargo run --bin test_profile
```

The cooler is driven from Windows, so to produce a Windows binary from a Linux
box, cross-compile with cargo-xwin:

```
cargo xwin build --release --target x86_64-pc-windows-msvc
```

## Supported models

| Model               | USB ID    | Radiator fans |
|---------------------|-----------|---------------|
| MEG Coreliquid S280 | 0db0:6a04 | 2             |
| MEG Coreliquid S360 | 0db0:6a05 | 3             |
| MPG Coreliquid K360 | 0db0:b130 | 3             |

## Status

The S280 is the model the protocol was captured on, so its behavior is
confirmed. The S360 and K360 share the same protocol family and have confirmed
product IDs. Their channel mapping is inferred from that shared protocol and has
not been verified on hardware. 
