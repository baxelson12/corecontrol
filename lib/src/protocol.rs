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
/// Highest plausible speed; readings above it are rejected as implausible.
const RPM_CEILING: u16 = 12_000;

/// Byte offset of the first channel's speed in a status reply.
const STATUS_RPM_OFFSET: usize = 0x02;
/// Byte offset of the first channel's duty in a status reply.
const STATUS_DUTY_OFFSET: usize = 0x16;

// --- Curve point limits (public) --------------------------------------------

/// Fewest points a curve may carry. The firmware rejects fewer than four.
pub const MIN_CURVE_POINTS: usize = 4;
/// Most points a curve may carry; also the value bytes available per slot.
pub const MAX_CURVE_POINTS: usize = 7;
/// Bytes per slot: one mode byte plus the curve values.
const SLOT_STRIDE: usize = MAX_CURVE_POINTS + 1;
/// Lowest pump duty a safe default configuration may use.
const MIN_SAFE_PUMP_DUTY: u8 = 50;

// Compile-time layout invariants tying the offsets above together.
const _: () = assert!(
    FIRST_SLOT_OFFSET + CHANNEL_COUNT * SLOT_STRIDE <= REPORT_LEN,
    "channel slots overflow the report"
);
const _: () = assert!(
    STATUS_RPM_OFFSET + CHANNEL_COUNT * 2 <= STATUS_DUTY_OFFSET,
    "status speed block overlaps the duty block"
);
const _: () = assert!(
    STATUS_DUTY_OFFSET + CHANNEL_COUNT * 2 <= REPORT_LEN,
    "status duty block overflows the report"
);

// --- Status -----------------------------------------------------------------

/// Measured speeds and duty cycles for the mapped channels, from one status
/// reply.
///
/// The layout matches liquidctl's driver for the same cooler family: five
/// little-endian u16 speeds from offset `0x02`, five little-endian u16 duty
/// percentages from offset `0x16`, in channel-slot order. Readings outside
/// plausible bounds are rejected during parsing.
#[derive(Debug, Clone, Copy)]
pub struct FanStatus {
    /// Speed of the first radiator fan in RPM.
    pub radiator_rpm: u16,
    /// Duty of the radiator fan channel, in percent (0-100).
    pub radiator_duty: u8,
    /// Waterblock (60 mm) fan speed in RPM.
    pub waterblock_rpm: u16,
    /// Duty of the waterblock fan channel, in percent (0-100).
    pub waterblock_duty: u8,
    /// Pump speed in RPM.
    pub pump_rpm: u16,
    /// Duty of the pump channel, in percent (0-100).
    pub pump_duty: u8,
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
    /// Builds a curve from `MIN_CURVE_POINTS`..=`MAX_CURVE_POINTS` points,
    /// each a (temperature C, duty %) pair. Temperatures must be non-zero and
    /// strictly increasing. This is the only constructor, so every
    /// `ChannelCurve` in existence has passed this validation.
    ///
    /// # Errors
    /// Returns `ControllerError::InvalidCurve` when the slice carries fewer
    /// than `MIN_CURVE_POINTS` or more than `MAX_CURVE_POINTS` points, a
    /// temperature is zero or implausibly high, a duty exceeds 100 %, or the
    /// temperatures do not strictly increase.
    pub fn try_from_points(points: &[(u8, u8)]) -> Result<ChannelCurve, ControllerError> {
        if points.len() < MIN_CURVE_POINTS {
            return Err(ControllerError::InvalidCurve("fewer than four points"));
        }
        if points.len() > MAX_CURVE_POINTS {
            return Err(ControllerError::InvalidCurve("more than seven points"));
        }
        if points
            .iter()
            .any(|&(temp, _)| temp == 0 || temp > TEMP_CEILING)
        {
            return Err(ControllerError::InvalidCurve("temperature must be 1-120 C"));
        }
        if points.iter().any(|&(_, duty)| duty > MAX_DUTY) {
            return Err(ControllerError::InvalidCurve("duty must be 0-100 %"));
        }
        if !points
            .iter()
            .zip(points.iter().skip(1))
            .all(|(a, b)| b.0 > a.0)
        {
            return Err(ControllerError::InvalidCurve(
                "temperatures must strictly increase",
            ));
        }
        let mut temps = [0u8; MAX_CURVE_POINTS];
        let mut duties = [0u8; MAX_CURVE_POINTS];
        for ((temp_slot, duty_slot), &(temp, duty)) in
            temps.iter_mut().zip(duties.iter_mut()).zip(points)
        {
            *temp_slot = temp;
            *duty_slot = duty;
        }

        Ok(ChannelCurve {
            mode: CURVE_MODE,
            temps,
            duties,
        })
    }

    /// Number of populated points: the length of the leading run of non-zero
    /// temperatures. Entries beyond it in [`ChannelCurve::points`] are
    /// padding.
    #[must_use]
    pub fn point_count(&self) -> usize {
        self.temps.iter().take_while(|&&temp| temp != 0).count()
    }

    /// Returns the curve as `MAX_CURVE_POINTS` (temperature C, duty %) pairs,
    /// for an application to display the current profile.
    #[must_use]
    pub fn points(&self) -> [(u8, u8); MAX_CURVE_POINTS] {
        let mut pairs = [(0u8, 0u8); MAX_CURVE_POINTS];
        for (pair, (&temp, &duty)) in pairs.iter_mut().zip(self.temps.iter().zip(&self.duties)) {
            *pair = (temp, duty);
        }

        pairs
    }
}

// --- Default curves ----------------------------------------------------------

/// Default fan curve for the radiator and waterblock slots: a moderate ramp.
const DEFAULT_FAN_CURVE: ChannelCurve = ChannelCurve {
    mode: CURVE_MODE,
    temps: [35, 45, 60, 75, 0, 0, 0],
    duties: [30, 45, 75, 100, 0, 0, 0],
};

/// Default pump curve: high duty throughout, so the loop never starves.
const DEFAULT_PUMP_CURVE: ChannelCurve = ChannelCurve {
    mode: CURVE_MODE,
    temps: [30, 45, 60, 75, 0, 0, 0],
    duties: [80, 85, 95, 100, 0, 0, 0],
};

/// Compile-time validity check for the built-in curves: a leading run of at
/// least `MIN_CURVE_POINTS` non-zero, strictly increasing temperatures, and
/// every value within the firmware's bounds. Mirrors what
/// [`ChannelCurve::try_from_points`] enforces at runtime.
// Indexing is const-evaluated: an out-of-bounds access aborts the build.
#[allow(clippy::indexing_slicing)]
const fn valid_curve(curve: &ChannelCurve) -> bool {
    let mut count = 0;
    while count < MAX_CURVE_POINTS && curve.temps[count] != 0 {
        count += 1;
    }
    if curve.mode != CURVE_MODE || count < MIN_CURVE_POINTS {
        return false;
    }
    let mut index = 0;
    while index < MAX_CURVE_POINTS {
        if curve.duties[index] > MAX_DUTY || curve.temps[index] > TEMP_CEILING {
            return false;
        }
        if index + 1 < count && curve.temps[index + 1] <= curve.temps[index] {
            return false;
        }
        index += 1;
    }

    true
}

const _: () = assert!(valid_curve(&DEFAULT_FAN_CURVE), "default fan curve invalid");
const _: () = assert!(
    valid_curve(&DEFAULT_PUMP_CURVE),
    "default pump curve invalid"
);
// Indexing is const-evaluated: an out-of-bounds access aborts the build.
#[allow(clippy::indexing_slicing)]
const _: () = assert!(
    DEFAULT_PUMP_CURVE.duties[0] >= MIN_SAFE_PUMP_DUTY,
    "default pump curve idles too low"
);

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
    #[must_use]
    pub fn new() -> FanConfig {
        let mut channels = [DEFAULT_FAN_CURVE; CHANNEL_COUNT];
        channels[CH_PUMP] = DEFAULT_PUMP_CURVE;

        FanConfig { channels }
    }

    /// Applies one curve to every radiator fan slot. On two-fan models the
    /// extra fan slots have no physical channel; they are written for
    /// uniformity, so suspect them first if a model misbehaves.
    pub fn set_radiators(&mut self, curve: ChannelCurve) {
        self.channels[0..CH_WATERBLOCK].fill(curve);
    }

    /// Sets the waterblock-fan curve (fixed slot 3).
    pub fn set_waterblock(&mut self, curve: ChannelCurve) {
        self.channels[CH_WATERBLOCK] = curve;
    }

    /// Sets the pump curve (fixed slot 4).
    pub fn set_pump(&mut self, curve: ChannelCurve) {
        self.channels[CH_PUMP] = curve;
    }

    /// Returns the radiator curve (representative slot 0), for display.
    #[must_use]
    pub fn radiators(&self) -> ChannelCurve {
        self.channels[0]
    }

    /// Returns the waterblock curve, for display.
    #[must_use]
    pub fn waterblock(&self) -> ChannelCurve {
        self.channels[CH_WATERBLOCK]
    }

    /// Returns the pump curve, for display.
    #[must_use]
    pub fn pump(&self) -> ChannelCurve {
        self.channels[CH_PUMP]
    }

    /// Serializes the duty (`0x40`) or temperature (`0x41`) report body.
    pub(crate) fn serialize(&self, command: u8) -> [u8; REPORT_LEN] {
        debug_assert!(
            command == CMD_SET_DUTY || command == CMD_SET_TEMP,
            "serialize called with a non-config command: {command:#x}"
        );
        let mut buffer = build_command(command, &[]);
        let (_, slot_area) = buffer.split_at_mut(FIRST_SLOT_OFFSET);
        for (slot, curve) in slot_area.chunks_exact_mut(SLOT_STRIDE).zip(&self.channels) {
            let values = if command == CMD_SET_DUTY {
                &curve.duties
            } else {
                &curve.temps
            };
            if let [mode, points @ ..] = slot {
                *mode = curve.mode;
                points.copy_from_slice(values);
            }
        }

        buffer
    }
}

impl Default for FanConfig {
    fn default() -> FanConfig {
        FanConfig::new()
    }
}

// --- Report helpers ---------------------------------------------------------

/// Builds a fixed-size report: prefix byte, command byte, then the payload,
/// zero-padded to the report length. No allocation occurs.
pub(crate) fn build_command(command: u8, payload: &[u8]) -> [u8; REPORT_LEN] {
    debug_assert!(
        payload.len() + 2 <= REPORT_LEN,
        "payload too large for report"
    );
    let mut buffer = [0u8; REPORT_LEN];
    buffer[0] = WRITE_PREFIX;
    buffer[1] = command;
    for (slot, &byte) in buffer.iter_mut().skip(2).zip(payload) {
        *slot = byte;
    }

    buffer
}

/// Reads one channel's little-endian u16 from a status reply block. The
/// layout invariants at the top of the module guarantee the pair is inside
/// the report, so a miss can only mean an internal bug; it reads as zero.
fn status_channel_u16(report: &[u8; REPORT_LEN], base: usize, channel: usize) -> u16 {
    debug_assert!(channel < CHANNEL_COUNT, "channel outside the report");
    debug_assert!(
        base == STATUS_RPM_OFFSET || base == STATUS_DUTY_OFFSET,
        "not a status block offset: {base:#x}"
    );
    let pair = report
        .get(base + channel * 2..)
        .and_then(|block| block.first_chunk::<2>());
    debug_assert!(pair.is_some(), "status pair outside the report");

    pair.map_or(0, |bytes| u16::from_le_bytes(*bytes))
}

/// Reads one channel's speed from a status reply, rejecting implausible
/// values (a sign of a corrupt or misaligned reply).
fn status_rpm(report: &[u8; REPORT_LEN], channel: usize) -> Result<u16, ControllerError> {
    let value = status_channel_u16(report, STATUS_RPM_OFFSET, channel);
    if value > RPM_CEILING {
        return Err(ControllerError::ImplausibleReading(value));
    }

    Ok(value)
}

/// Reads one channel's duty percentage from a status reply, rejecting values
/// above 100.
fn status_duty(report: &[u8; REPORT_LEN], channel: usize) -> Result<u8, ControllerError> {
    let value = status_channel_u16(report, STATUS_DUTY_OFFSET, channel);
    if value > u16::from(MAX_DUTY) {
        return Err(ControllerError::ImplausibleReading(value));
    }

    u8::try_from(value).map_err(|_| ControllerError::ImplausibleReading(value))
}

/// Extracts one channel's curve from a duty/temperature reply pair, or
/// `None` when the slot does not carry a well-formed custom curve (a
/// different mode byte, too few points, or out-of-range values).
fn parse_curve_slot(
    duty_report: &[u8; REPORT_LEN],
    temp_report: &[u8; REPORT_LEN],
    channel: usize,
) -> Option<ChannelCurve> {
    debug_assert!(channel < CHANNEL_COUNT, "channel outside the report");
    let [duty_mode, duties @ ..] = *slot_bytes(duty_report, channel)?;
    let [temp_mode, temps @ ..] = *slot_bytes(temp_report, channel)?;
    if duty_mode != CURVE_MODE || temp_mode != CURVE_MODE {
        return None;
    }
    let mut pairs = [(0u8, 0u8); MAX_CURVE_POINTS];
    for (pair, (&temp, &duty)) in pairs.iter_mut().zip(temps.iter().zip(&duties)) {
        *pair = (temp, duty);
    }
    let count = pairs.iter().take_while(|&&(temp, _)| temp != 0).count();

    ChannelCurve::try_from_points(pairs.get(..count)?).ok()
}

/// Returns one channel's slot (mode byte plus curve values) from a
/// configuration reply. The layout invariants at the top of the module keep
/// every channel's slot inside the report.
fn slot_bytes(report: &[u8; REPORT_LEN], channel: usize) -> Option<&[u8; SLOT_STRIDE]> {
    report
        .get(FIRST_SLOT_OFFSET..)
        .and_then(|slots| slots.chunks_exact(SLOT_STRIDE).nth(channel))
        .and_then(|slot| slot.try_into().ok())
}

/// Parses a duty-configuration reply (`0x32`) and a temperature reply
/// (`0x33`) into the profile the device is running. Returns `None` when any
/// channel slot is not a well-formed custom curve, meaning the device is in
/// another mode or has no profile applied. The slot layout mirrors the set
/// reports and matches liquidctl's driver for the same family.
pub(crate) fn parse_profile(
    duty_report: &[u8; REPORT_LEN],
    temp_report: &[u8; REPORT_LEN],
) -> Result<Option<FanConfig>, ControllerError> {
    if duty_report[1] != CMD_GET_DUTY {
        return Err(ControllerError::UnexpectedResponse(duty_report[1]));
    }
    // The S280 echoes 0x32 in the temperature reply as well, so both config
    // echoes are accepted; the request order pairs the replies.
    if temp_report[1] != CMD_GET_TEMP && temp_report[1] != CMD_GET_DUTY {
        return Err(ControllerError::UnexpectedResponse(temp_report[1]));
    }
    let Some(first) = parse_curve_slot(duty_report, temp_report, 0) else {
        return Ok(None);
    };
    let mut channels = [first; CHANNEL_COUNT];
    for (channel, slot) in channels.iter_mut().enumerate().skip(1) {
        let Some(curve) = parse_curve_slot(duty_report, temp_report, channel) else {
            return Ok(None);
        };
        *slot = curve;
    }

    Ok(Some(FanConfig { channels }))
}

/// Parses a status reply into speeds and duties for the mapped channels. The
/// speed offsets are capture-confirmed; the duty offsets match liquidctl's
/// driver for the same family.
pub(crate) fn parse_status(report: &[u8; REPORT_LEN]) -> Result<FanStatus, ControllerError> {
    if report[1] != CMD_STATUS {
        return Err(ControllerError::UnexpectedResponse(report[1]));
    }

    Ok(FanStatus {
        radiator_rpm: status_rpm(report, 0)?,
        radiator_duty: status_duty(report, 0)?,
        waterblock_rpm: status_rpm(report, CH_WATERBLOCK)?,
        waterblock_duty: status_duty(report, CH_WATERBLOCK)?,
        pump_rpm: status_rpm(report, CH_PUMP)?,
        pump_duty: status_duty(report, CH_PUMP)?,
    })
}
