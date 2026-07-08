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
    └── list_devices.rs   lists the HID interfaces hidapi can see
```

## What each piece does

### protocol.rs

The wire format lives here: the 64-byte report structure, the command bytes,
and the five channel slots. Two public types carry most of the weight.

`ChannelCurve` is a single fan curve, built with
`ChannelCurve::from_points(&[(temp, duty), ...])`. A curve takes between
`MIN_CURVE_POINTS` (4) and `MAX_CURVE_POINTS` (7) points, with non-zero,
strictly increasing temperatures. Anything outside those bounds is rejected at
construction, because the firmware rejects it too.

`FanConfig` holds the curves for every channel (radiator fans, waterblock fan,
pump) and serializes them into the two reports the device expects. `FanStatus`
and the status parser also live here, though the status reply layout is not yet
confirmed against hardware.

### cooler.rs

`Cooler` is the handle to an open device. It provides:

- `Cooler::detect()` and `Cooler::open(api, spec)` to find and open a cooler
- `initialize()` to run the connect handshake the device expects before control
- `new_config()` to get a `FanConfig` seeded with safe defaults
- `apply_config(&config)` to write a profile
- `push_cpu_temp(temp)` to feed the device a temperature so it evaluates curves
- `status()` to read speeds back

### models/

Each supported cooler is a small file exposing one `SPEC` constant: its USB
product ID, display name, and radiator fan count. `mod.rs` gathers those into a
registry and exposes `available_devices()` for detection and `known_models()`
for listing. Adding a cooler is a new file plus one line in the registry array,
with no other code touched.

### error.rs

`ControllerError`, the single error type every fallible call returns.

### bin/

`test_profile` applies a fixed profile and is handy for confirming the hardware
responds. `list_devices` is a read-only diagnostic that prints every MSI HID
interface hidapi enumerates, useful when a cooler is not being detected.

## Usage

```rust
use coreliquid::{ChannelCurve, Cooler};

let mut cooler = Cooler::detect()?;
cooler.initialize()?;

let mut config = cooler.new_config();
config.set_radiators(ChannelCurve::from_points(&[(35, 30), (50, 55), (65, 80), (80, 100)]));
config.set_pump(ChannelCurve::from_points(&[(30, 80), (45, 85), (60, 95), (75, 100)]));
cooler.apply_config(&config)?;
```

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
