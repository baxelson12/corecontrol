//! Simple fixed-profile test for the Coreliquid controller.
//!
//! Detects the cooler, runs the connect handshake, and applies one profile:
//! radiator fans and the unit (waterblock) fan at 90%, pump at 80%. Each curve
//! is a four-point flat curve (the confirmed minimum) with non-zero, increasing
//! temperatures, so the applied duty is constant regardless of temperature.
//!
//! Build and run from the crate root: `cargo run --bin test_profile`.

use coreliquid::{ChannelCurve, ControllerError, Cooler, FanConfig};

/// The duties and evaluation temperature this test applies, grouped because
/// they are the parameters of one profile and change together.
struct Settings {
    radiator_duty: u8,
    unit_duty: u8,
    pump_duty: u8,
    push_temp: u8,
}

/// The fixed profile under test: fans at 90%, pump at 80%.
const SETTINGS: Settings = Settings {
    radiator_duty: 90,
    unit_duty: 90,
    pump_duty: 80,
    push_temp: 50,
};

/// Highest legal duty percentage, mirrored locally for parameter checks.
const MAX_DUTY_PERCENT: u8 = 100;
/// Highest plausible temperature to push, for parameter checks.
const TEMP_MAX: u8 = 120;

/// Process exit code for a successful run.
const EXIT_OK: i32 = 0;
/// Process exit code for a failed run.
const EXIT_FAILURE: i32 = 1;

// The settings are fixed constants, so their validity is checked once here.
const _: () = assert!(
    SETTINGS.radiator_duty <= MAX_DUTY_PERCENT,
    "radiator duty out of range"
);
const _: () = assert!(
    SETTINGS.unit_duty <= MAX_DUTY_PERCENT,
    "unit duty out of range"
);
const _: () = assert!(
    SETTINGS.pump_duty <= MAX_DUTY_PERCENT,
    "pump duty out of range"
);
const _: () = assert!(
    SETTINGS.push_temp <= TEMP_MAX,
    "push temperature implausible"
);

/// Builds a four-point curve holding `duty` across an increasing temperature
/// span, satisfying the device's curve requirements (four points, non-zero and
/// ascending temperatures).
fn flat_curve(duty: u8) -> ChannelCurve {
    assert!(duty <= MAX_DUTY_PERCENT, "duty out of range: {duty}");
    let curve = ChannelCurve::from_points(&[(30, duty), (45, duty), (60, duty), (75, duty)]);
    let points = curve.points();
    assert!(
        points[0].1 == duty,
        "curve did not store the requested duty"
    );

    curve
}

/// Builds the fixed profile from `SETTINGS`.
fn build_profile(cooler: &Cooler) -> FanConfig {
    assert!(
        cooler.model().radiator_fans >= 1,
        "cooler model has no radiator fan"
    );
    let mut config = cooler.new_config();
    config.set_radiators(flat_curve(SETTINGS.radiator_duty));
    config.set_waterblock(flat_curve(SETTINGS.unit_duty));
    config.set_pump(flat_curve(SETTINGS.pump_duty));

    config
}

/// Detects a cooler, applies the fixed profile, and pushes a temperature so the
/// device evaluates the curves.
fn run() -> Result<(), ControllerError> {
    let mut cooler = Cooler::detect()?;
    cooler.initialize()?;
    println!("Detected {}.", cooler.model().name);
    let profile = build_profile(&cooler);
    cooler.apply_config(&profile)?;
    cooler.push_cpu_temp(SETTINGS.push_temp)?;
    println!(
        "Applied: radiators {}%, unit fan {}%, pump {}%.",
        SETTINGS.radiator_duty, SETTINGS.unit_duty, SETTINGS.pump_duty
    );

    Ok(())
}

/// Runs the test and maps the result to a process exit code.
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
