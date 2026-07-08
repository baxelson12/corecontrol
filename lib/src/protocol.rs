//! On-wire report format, fan curves, and channel configuration.
//!
//! Every report is 64 bytes: a `0xd0` prefix, a command byte, then five 8-byte
//! channel slots (a mode byte plus seven curve values). Confirmed against a USB
//! capture of MSI Center on an S280.

use crate::error::ControllerError;

// --- Wire format (crate-internal) -------------------------------------------

/// Length of every HID report exchanged with the cooler, in bytes.
pub(crate) const REPORT_LEN: usize = 64;
/// First byte of every outgoing report.
pub(crate) const WRITE_PREFIX: u8 = 0xd0;

/// Command byte requesting a status report.
pub(crate) const CMD_STATUS: u8 = 0x31;
/// Command byte reading back the current duty configuration.
pub(crate) const CMD_GET_DUTY: u8 = 0x32;
/// Command byte reading back the current temperature configuration.
pub(crate) const CMD_GET_TEMP: u8 = 0x33;
/// Command byte writing per-channel duty values.
pub(crate) const CMD_SET_DUTY: u8 = 0x40;
/// Command byte writing per-channel temperature breakpoints.
pub(crate) const CMD_SET_TEMP: u8 = 0x41;
/// Command byte pushing the current CPU frequency and temperature.
pub(crate) const CMD_PUSH_CPU: u8 = 0x85;

/// Per-slot mode byte observed for a custom curve.
const CURVE_MODE: u8 = 0x03;

/// Number of channel slots in a duty/temperature report.
pub(crate) const CHANNEL_COUNT: usize = 5;
/// Offset of the first slot, immediately after prefix and command bytes.
const FIRST_SLOT_OFFSET: usize = 2;
/// Fixed slot index of the waterblock (60 mm) fan channel.
pub(crate) const CH_WATERBLOCK: usize = 3;
/// Fixed slot index of the pump channel.
pub(crate) const CH_PUMP: usize = 4;

/// Highest legal duty percentage.
pub(crate) const MAX_DUTY: u8 = 100;
/// Highest plausible temperature, in degrees Celsius.
pub(crate) const TEMP_CEILING: u8 = 120;
/// Highest plausible speed, used only for sanity assertions.
const RPM_CEILING: u16 = 12_000;

// --- Curve point limits (public) --------------------------------------------

/// Fewest points a curve may carry. The firmware rejects fewer than four.
pub const MIN_CURVE_POINTS: usize = 4;
/// Most points a curve may carry; also the value bytes available per slot.
pub const MAX_CURVE_POINTS: usize = 7;
/// Bytes per slot: one mode byte plus the curve values.
const SLOT_STRIDE: usize = MAX_CURVE_POINTS + 1;
/// Lowest pump duty a safe default configuration may use.
const MIN_SAFE_PUMP_DUTY: u8 = 50;

// Compile-time invariants over the constants above.
const _: () = assert!(
    CH_WATERBLOCK < CHANNEL_COUNT,
    "waterblock slot outside the report"
);
const _: () = assert!(CH_PUMP < CHANNEL_COUNT, "pump slot outside the report");
const _: () = assert!(
    MIN_CURVE_POINTS <= MAX_CURVE_POINTS,
    "curve point range inverted"
);
const _: () = assert!(
    CMD_SET_DUTY != CMD_SET_TEMP,
    "set-config opcodes must differ"
);
const _: () = assert!(
    CMD_GET_DUTY != CMD_GET_TEMP,
    "get-config opcodes must differ"
);
const _: () = assert!(
    FIRST_SLOT_OFFSET + CHANNEL_COUNT * SLOT_STRIDE <= REPORT_LEN,
    "channel slots overflow the report"
);

// --- Status -----------------------------------------------------------------

/// Measured speeds for the mapped channels, as reported by the device.
///
/// The status reply layout is not yet capture-confirmed; the offsets in
/// `parse_status` are guarded by plausibility assertions.
#[derive(Debug, Clone, Copy)]
pub struct FanStatus {
    /// Speed of the first radiator fan in RPM.
    pub radiator_rpm: u16,
    /// Waterblock (60 mm) fan speed in RPM.
    pub waterblock_rpm: u16,
    /// Pump speed in RPM.
    pub pump_rpm: u16,
}

// --- Channel curve ----------------------------------------------------------

/// One channel's fan curve: a mode byte plus paired temperature and duty
/// points. Unused trailing points stay zero, matching MSI Center's reports.
#[derive(Debug, Clone, Copy)]
pub struct ChannelCurve {
    mode: u8,
    temps: [u8; MAX_CURVE_POINTS],
    duties: [u8; MAX_CURVE_POINTS],
}

impl ChannelCurve {
    /// Builds a curve from `MIN_CURVE_POINTS`..=`MAX_CURVE_POINTS` points, each
    /// a (temperature C, duty %) pair. Temperatures must be non-zero and
    /// strictly increasing; a leading 0 C point is treated as an empty curve.
    pub fn from_points(points: &[(u8, u8)]) -> ChannelCurve {
        assert!(
            points.len() >= MIN_CURVE_POINTS,
            "curve needs at least four points"
        );
        assert!(
            points.len() <= MAX_CURVE_POINTS,
            "curve accepts at most seven points"
        );
        assert!(points[0].0 != 0, "first curve point must start above 0 C");
        assert!(
            points
                .iter()
                .all(|&(t, d)| t <= TEMP_CEILING && d <= MAX_DUTY),
            "curve point out of range"
        );
        assert!(
            points.windows(2).all(|pair| pair[1].0 > pair[0].0),
            "curve temperatures must strictly increase"
        );
        let mut temps = [0u8; MAX_CURVE_POINTS];
        let mut duties = [0u8; MAX_CURVE_POINTS];
        let mut index = 0;
        while index < points.len() {
            temps[index] = points[index].0;
            duties[index] = points[index].1;
            index += 1;
        }

        ChannelCurve {
            mode: CURVE_MODE,
            temps,
            duties,
        }
    }

    /// Returns the curve as `MAX_CURVE_POINTS` (temperature C, duty %) pairs,
    /// for an application to display the current profile.
    pub fn points(&self) -> [(u8, u8); MAX_CURVE_POINTS] {
        assert!(
            self.duties.iter().all(|&d| d <= MAX_DUTY),
            "duty invariant violated"
        );
        assert!(
            self.temps.iter().all(|&t| t <= TEMP_CEILING),
            "temp invariant violated"
        );
        let mut pairs = [(0u8, 0u8); MAX_CURVE_POINTS];
        let mut index = 0;
        while index < MAX_CURVE_POINTS {
            pairs[index] = (self.temps[index], self.duties[index]);
            index += 1;
        }

        pairs
    }
}

// --- Fan configuration ------------------------------------------------------

/// The full configuration for all five channel slots. Radiator writes apply
/// uniformly to every fan slot; the waterblock and pump have their own slots.
#[derive(Debug, Clone)]
pub struct FanConfig {
    channels: [ChannelCurve; CHANNEL_COUNT],
}

impl FanConfig {
    /// Creates a configuration with conservative safe defaults: a moderate fan
    /// ramp on the fan and waterblock slots, and a high pump curve. All curves
    /// carry four points, the confirmed minimum.
    pub fn new() -> FanConfig {
        let fan = ChannelCurve::from_points(&[(35, 30), (45, 45), (60, 75), (75, 100)]);
        let pump = ChannelCurve::from_points(&[(30, 80), (45, 85), (60, 95), (75, 100)]);
        let mut channels = [fan; CHANNEL_COUNT];
        channels[CH_PUMP] = pump;
        assert!(
            pump.duties[0] >= MIN_SAFE_PUMP_DUTY,
            "pump default must not idle low"
        );
        assert_eq!(channels.len(), CHANNEL_COUNT, "channel array wrong size");

        FanConfig { channels }
    }

    /// Applies one curve to every radiator fan slot. On two-fan models the
    /// extra fan slots have no physical channel; they are written for
    /// uniformity, so suspect them first if a model misbehaves.
    pub fn set_radiators(&mut self, curve: ChannelCurve) {
        assert!(
            curve.duties.iter().all(|&d| d <= MAX_DUTY),
            "duty out of range"
        );
        self.channels[0..CH_WATERBLOCK].fill(curve);
    }

    /// Sets the waterblock-fan curve (fixed slot 3).
    pub fn set_waterblock(&mut self, curve: ChannelCurve) {
        assert!(
            curve.duties.iter().all(|&d| d <= MAX_DUTY),
            "duty out of range"
        );
        self.channels[CH_WATERBLOCK] = curve;
    }

    /// Sets the pump curve (fixed slot 4).
    pub fn set_pump(&mut self, curve: ChannelCurve) {
        assert!(
            curve.duties.iter().all(|&d| d <= MAX_DUTY),
            "duty out of range"
        );
        self.channels[CH_PUMP] = curve;
    }

    /// Returns the radiator curve (representative slot 0), for display.
    pub fn radiators(&self) -> ChannelCurve {
        self.channels[0]
    }

    /// Returns the waterblock curve, for display.
    pub fn waterblock(&self) -> ChannelCurve {
        self.channels[CH_WATERBLOCK]
    }

    /// Returns the pump curve, for display.
    pub fn pump(&self) -> ChannelCurve {
        self.channels[CH_PUMP]
    }

    /// Serializes the duty (`0x40`) or temperature (`0x41`) report body.
    pub(crate) fn serialize(&self, command: u8) -> [u8; REPORT_LEN] {
        assert!(
            command == CMD_SET_DUTY || command == CMD_SET_TEMP,
            "serialize called with a non-config command: {command:#x}"
        );
        let mut buffer = build_command(command, &[]);
        let mut channel = 0;
        while channel < CHANNEL_COUNT {
            let slot = FIRST_SLOT_OFFSET + channel * SLOT_STRIDE;
            let values = if command == CMD_SET_DUTY {
                &self.channels[channel].duties
            } else {
                &self.channels[channel].temps
            };
            buffer[slot] = self.channels[channel].mode;
            buffer[slot + 1..slot + 1 + MAX_CURVE_POINTS].copy_from_slice(values);
            channel += 1;
        }
        assert_eq!(
            buffer[0], WRITE_PREFIX,
            "prefix overwritten during serialize"
        );

        buffer
    }
}

impl Default for FanConfig {
    fn default() -> FanConfig {
        let config = FanConfig::new();
        assert_eq!(
            config.channels.len(),
            CHANNEL_COUNT,
            "default channel count wrong"
        );
        assert!(
            config.channels[CH_PUMP].duties[0] >= MIN_SAFE_PUMP_DUTY,
            "default pump too low"
        );

        config
    }
}

// --- Report helpers ---------------------------------------------------------

/// Builds a fixed-size report: prefix byte, command byte, then the payload,
/// zero-padded to the report length. No allocation occurs.
pub(crate) fn build_command(command: u8, payload: &[u8]) -> [u8; REPORT_LEN] {
    assert!(
        payload.len() + 2 <= REPORT_LEN,
        "payload too large for report"
    );
    let mut buffer = [0u8; REPORT_LEN];
    buffer[0] = WRITE_PREFIX;
    buffer[1] = command;
    buffer[2..2 + payload.len()].copy_from_slice(payload);
    assert_eq!(buffer[1], command, "command byte not placed correctly");

    buffer
}

/// Parses a status reply. Only the request opcode is confirmed; the byte
/// offsets here are unverified and guarded by plausibility assertions.
pub(crate) fn parse_status(report: &[u8; REPORT_LEN]) -> Result<FanStatus, ControllerError> {
    assert_eq!(report.len(), REPORT_LEN, "status report wrong length");
    if report[1] != CMD_STATUS {
        return Err(ControllerError::UnexpectedResponse(report[1]));
    }
    let status = FanStatus {
        radiator_rpm: u16::from_le_bytes([report[2], report[3]]),
        waterblock_rpm: u16::from_le_bytes([report[8], report[9]]),
        pump_rpm: u16::from_le_bytes([report[10], report[11]]),
    };
    assert!(
        status.pump_rpm <= RPM_CEILING,
        "pump rpm implausible - offsets wrong?"
    );
    assert!(
        status.radiator_rpm <= RPM_CEILING,
        "radiator rpm implausible - offsets wrong?"
    );

    Ok(status)
}
