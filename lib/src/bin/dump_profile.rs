//! Prints the cooler's raw configuration replies and the profile parsed from
//! them, for verifying the read-back protocol on real hardware.
//!
//! Detects the cooler, runs the connect handshake, dumps the two replies as
//! hex, then shows what `read_profile` makes of them. When the parse comes
//! back `none` against expectations, the hex shows which assumption broke
//! (command-byte echo, slot mode bytes, or the curve values themselves).
//!
//! Build and run from the crate root: `cargo run --bin dump_profile`.

use coreliquid::{ChannelCurve, ControllerError, Cooler, FanConfig, MAX_CURVE_POINTS};

/// Process exit code for a successful run.
const EXIT_OK: i32 = 0;
/// Process exit code for a failed run.
const EXIT_FAILURE: i32 = 1;

/// Prints one channel's populated points as `temp C -> duty %` pairs.
fn print_channel(name: &str, curve: &ChannelCurve) {
    let count = curve.point_count();
    assert!(count <= MAX_CURVE_POINTS, "point count out of range");
    let points = curve.points();
    print!("  {name}:");
    for &(temp, duty) in points.iter().take(count) {
        print!(" {temp}C={duty}%");
    }
    println!();
}

/// Prints the three display channels of a parsed profile.
fn print_profile(config: &FanConfig) {
    print_channel("radiators ", &config.radiators());
    print_channel("waterblock", &config.waterblock());
    print_channel("pump      ", &config.pump());
}

/// Detects a cooler, dumps its raw configuration replies, and prints the
/// parsed profile.
fn run() -> Result<(), ControllerError> {
    let mut cooler = Cooler::detect()?;
    cooler.initialize()?;
    println!("Detected {}.", cooler.model().name);
    println!("{}", cooler.dump_config_replies()?);
    match cooler.read_profile()? {
        Some(config) => {
            println!("Parsed profile:");
            print_profile(&config);
        }
        None => println!("Parsed profile: none (not a custom curve on every channel)"),
    }

    Ok(())
}

/// Runs the dump and maps the result to a process exit code.
fn main() {
    let code = match run() {
        Ok(()) => EXIT_OK,
        Err(error) => {
            eprintln!("Failed: {error:?}");
            EXIT_FAILURE
        }
    };
    assert!(
        code == EXIT_OK || code == EXIT_FAILURE,
        "exit code must be a known value"
    );
    assert!(code >= EXIT_OK, "exit code must be non-negative");
    std::process::exit(code);
}
