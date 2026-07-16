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
    /// Duty of the radiator fan channel, in percent (0–100).
    pub radiator_duty: u8,
    /// Waterblock (60 mm) fan speed in RPM.
    pub waterblock_rpm: u16,
    /// Duty of the waterblock fan channel, in percent (0–100).
    pub waterblock_duty: u8,
    /// Pump speed in RPM.
    pub pump_rpm: u16,
    /// Duty of the pump channel, in percent (0–100).
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
    /// Builds a curve from `MIN_CURVE_POINTS`..=`MAX_CURVE_POINTS` points, each
    /// a (temperature C, duty %) pair. Temperatures must be non-zero and
    /// strictly increasing. For input that crosses a trust boundary use
    /// [`ChannelCurve::try_from_points`] instead.
    ///
    /// # Panics
    /// Panics when [`ChannelCurve::try_from_points`] would reject the points.
    pub fn from_points(points: &[(u8, u8)]) -> ChannelCurve {
        match ChannelCurve::try_from_points(points) {
            Ok(curve) => curve,
            Err(error) => panic!("{error}"),
        }
    }

    /// Builds a curve from (temperature C, duty %) pairs, validating instead
    /// of panicking. This is the constructor for points arriving from outside
    /// the process (IPC payloads, config files).
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
        if !points.windows(2).all(|pair| pair[1].0 > pair[0].0) {
            return Err(ControllerError::InvalidCurve(
                "temperatures must strictly increase",
            ));
        }
        let mut temps = [0u8; MAX_CURVE_POINTS];
        let mut duties = [0u8; MAX_CURVE_POINTS];
        for (index, &(temp, duty)) in points.iter().enumerate() {
            temps[index] = temp;
            duties[index] = duty;
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
    pub fn point_count(&self) -> usize {
        self.temps.iter().take_while(|&&temp| temp != 0).count()
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

/// Reads one channel's little-endian u16 from a status reply block.
fn status_channel_u16(report: &[u8; REPORT_LEN], base: usize, channel: usize) -> u16 {
    assert!(channel < CHANNEL_COUNT, "channel outside the report");
    assert!(
        base == STATUS_RPM_OFFSET || base == STATUS_DUTY_OFFSET,
        "not a status block offset: {base:#x}"
    );
    let offset = base + channel * 2;

    u16::from_le_bytes([report[offset], report[offset + 1]])
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
    assert!(channel < CHANNEL_COUNT, "channel outside the report");
    let slot = FIRST_SLOT_OFFSET + channel * SLOT_STRIDE;
    if duty_report[slot] != CURVE_MODE || temp_report[slot] != CURVE_MODE {
        return None;
    }
    let temps = &temp_report[slot + 1..slot + 1 + MAX_CURVE_POINTS];
    let duties = &duty_report[slot + 1..slot + 1 + MAX_CURVE_POINTS];
    let mut pairs = [(0u8, 0u8); MAX_CURVE_POINTS];
    for (pair, (&temp, &duty)) in pairs.iter_mut().zip(temps.iter().zip(duties)) {
        *pair = (temp, duty);
    }
    let count = pairs.iter().take_while(|&&(temp, _)| temp != 0).count();

    ChannelCurve::try_from_points(pairs.get(..count)?).ok()
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
