//! Opening a detected cooler and applying or reading profiles.

use hidapi::{HidApi, HidDevice};

use crate::error::ControllerError;
use crate::models::{ModelSpec, VENDOR_ID, available_devices};
use crate::protocol::{
    CMD_GET_DUTY, CMD_GET_TEMP, CMD_PUSH_CPU, CMD_STATUS, FanConfig, FanStatus, REPORT_LEN,
    TEMP_CEILING, WRITE_PREFIX, build_command, parse_profile, parse_status,
};

/// HID report id of the feature report read during the connect handshake.
const HANDSHAKE_FEATURE_ID: u8 = 0x52;
/// Length of the feature report the device returns for report id 0x52.
const HANDSHAKE_FEATURE_LEN: usize = 185;
/// Read timeout for a reply, in milliseconds.
const READ_TIMEOUT_MS: i32 = 500;

/// An open connection to one detected cooler. Remembers the last profile it
/// applied so an application can display and edit it.
pub struct Cooler {
    device: HidDevice,
    spec: ModelSpec,
    current: Option<FanConfig>,
}

impl Cooler {
    /// Opens a specific model the caller has already chosen (typically after
    /// presenting the result of [`Cooler::scan`] and having the user confirm).
    /// Creates a private HID context for the connection.
    ///
    /// # Errors
    /// Returns `ControllerError::Hid` when the HID context cannot be created
    /// or the device cannot be opened.
    pub fn open(spec: ModelSpec) -> Result<Cooler, ControllerError> {
        let api = HidApi::new()?;

        Cooler::open_with(&api, spec)
    }

    /// Opens `spec` through an existing HID context.
    fn open_with(api: &HidApi, spec: ModelSpec) -> Result<Cooler, ControllerError> {
        let device = api.open(VENDOR_ID, spec.product_id)?;

        Ok(Cooler {
            device,
            spec,
            current: None,
        })
    }

    /// Enumerates the recognized models currently attached, without opening
    /// anything. An application calls this at startup to learn what is in the
    /// machine, then passes the chosen spec to [`Cooler::open`].
    ///
    /// # Errors
    /// Returns `ControllerError::Hid` when the HID context cannot be created.
    pub fn scan() -> Result<Vec<ModelSpec>, ControllerError> {
        crate::models::detect_attached()
    }

    /// Returns every model this controller can drive, for display or logging.
    pub fn known_models() -> &'static [ModelSpec] {
        crate::models::known_models()
    }

    /// Convenience: detects and opens the first recognized Coreliquid.
    pub fn detect() -> Result<Cooler, ControllerError> {
        let api = HidApi::new()?;
        let spec = available_devices(&api)
            .next()
            .ok_or(ControllerError::DeviceNotFound)?;

        Cooler::open_with(&api, spec)
    }

    /// Returns the detected model's spec, for display.
    pub fn model(&self) -> ModelSpec {
        self.spec
    }

    /// Returns the profile this controller last applied, or `None` if none has
    /// been applied yet. This is a software shadow, not a live device read.
    pub fn current_profile(&self) -> Option<&FanConfig> {
        self.current.as_ref()
    }

    /// Builds a fresh configuration with safe defaults for editing.
    pub fn new_config(&self) -> FanConfig {
        FanConfig::new()
    }

    /// Runs the connect handshake MSI Center performs before it drives the
    /// fans: a feature-report read followed by reads of the current fan
    /// configuration. Call once after opening.
    pub fn initialize(&self) -> Result<(), ControllerError> {
        self.read_handshake_feature()?;
        self.read_config(CMD_GET_DUTY)?;
        self.read_config(CMD_GET_TEMP)?;

        Ok(())
    }

    /// Issues the GET_FEATURE control request for report 0x52. The contents are
    /// not consumed; issuing the request is the part of the handshake that
    /// matters.
    fn read_handshake_feature(&self) -> Result<(), ControllerError> {
        let mut buffer = [0u8; HANDSHAKE_FEATURE_LEN + 1];
        buffer[0] = HANDSHAKE_FEATURE_ID;
        let read = self.device.get_feature_report(&mut buffer)?;
        debug_assert!(read <= buffer.len(), "feature read overran the buffer");

        Ok(())
    }

    /// Sends a read-request command and returns the 64-byte reply.
    fn read_config(&self, command: u8) -> Result<[u8; REPORT_LEN], ControllerError> {
        debug_assert!(
            command == CMD_GET_DUTY || command == CMD_GET_TEMP,
            "not a config-read command: {command:#x}"
        );
        let request = build_command(command, &[]);
        self.send_report(&request)?;
        let mut reply = [0u8; REPORT_LEN];
        let read = self.device.read_timeout(&mut reply, READ_TIMEOUT_MS)?;
        if read < REPORT_LEN {
            return Err(ControllerError::ShortRead(read));
        }

        Ok(reply)
    }

    /// Reads the raw duty (`0x32`) and temperature (`0x33`) configuration
    /// replies and formats them as hex, one report per line. A protocol
    /// diagnostic for checking the read-back layout on real hardware; the
    /// same bytes are what [`Cooler::read_profile`] parses.
    ///
    /// # Errors
    /// Returns `ControllerError::Hid` on transport failure and `ShortRead`
    /// on a truncated reply.
    pub fn dump_config_replies(&self) -> Result<String, ControllerError> {
        let duty = self.read_config(CMD_GET_DUTY)?;
        let temp = self.read_config(CMD_GET_TEMP)?;

        Ok(format!(
            "duty (0x32): {duty:02x?}\ntemp (0x33): {temp:02x?}"
        ))
    }

    /// Reads the profile the device is currently running by requesting its
    /// duty and temperature configuration and parsing the pair. On success
    /// the profile also becomes [`Cooler::current_profile`].
    ///
    /// # Returns
    /// The running configuration, or `None` when the device is not running a
    /// custom-curve profile on every channel (another mode is active, or no
    /// profile has ever been applied).
    ///
    /// # Errors
    /// Returns `ControllerError::Hid` on transport failure, `ShortRead` on a
    /// truncated reply, and `UnexpectedResponse` when a reply is not the
    /// requested configuration report.
    pub fn read_profile(&mut self) -> Result<Option<FanConfig>, ControllerError> {
        let duty_reply = self.read_config(CMD_GET_DUTY)?;
        let temp_reply = self.read_config(CMD_GET_TEMP)?;
        let profile = parse_profile(&duty_reply, &temp_reply)?;
        if let Some(config) = &profile {
            self.current = Some(config.clone());
        }

        Ok(profile)
    }

    /// Writes one fully-formed report to the device, verifying the transfer.
    fn send_report(&self, buffer: &[u8; REPORT_LEN]) -> Result<(), ControllerError> {
        debug_assert_eq!(buffer[0], WRITE_PREFIX, "report missing its prefix byte");
        let written = self.device.write(buffer)?;
        if written == 0 {
            return Err(ControllerError::ShortWrite(written));
        }

        Ok(())
    }

    /// Requests and parses a status report: the current speed and duty cycle
    /// of every mapped channel.
    ///
    /// # Errors
    /// Returns `ControllerError::Hid` on transport failure, `ShortRead` on a
    /// truncated reply, `UnexpectedResponse` when the reply is not a status
    /// report, and `ImplausibleReading` when a value is out of bounds.
    pub fn status(&self) -> Result<FanStatus, ControllerError> {
        let request = build_command(CMD_STATUS, &[]);
        self.send_report(&request)?;
        let mut reply = [0u8; REPORT_LEN];
        let read = self.device.read_timeout(&mut reply, READ_TIMEOUT_MS)?;
        if read < REPORT_LEN {
            return Err(ControllerError::ShortRead(read));
        }

        parse_status(&reply)
    }

    /// Applies a complete configuration in the two writes the device requires
    /// (duty values first, then temperature breakpoints), then records it as
    /// the current profile.
    pub fn apply_config(&mut self, config: &FanConfig) -> Result<(), ControllerError> {
        let duty_report = config.serialize(crate::protocol::CMD_SET_DUTY);
        let temp_report = config.serialize(crate::protocol::CMD_SET_TEMP);
        self.send_report(&duty_report)?;
        self.send_report(&temp_report)?;
        self.current = Some(config.clone());

        Ok(())
    }

    /// Forwards the current CPU temperature so the device's curves keep
    /// tracking. Must be called on a steady cadence by the caller's timer;
    /// frequency only drives the LCD readout and is left zero.
    ///
    /// # Errors
    /// Returns `ControllerError::ImplausibleReading` when `temp_c` exceeds the
    /// plausible ceiling (120 C), and `ControllerError::Hid` or `ShortWrite`
    /// on transport failure.
    pub fn push_cpu_temp(&self, temp_c: u8) -> Result<(), ControllerError> {
        if temp_c > TEMP_CEILING {
            return Err(ControllerError::ImplausibleReading(u16::from(temp_c)));
        }
        let payload = [0u8, 0u8, temp_c, 0u8];
        let report = build_command(CMD_PUSH_CPU, &payload);

        self.send_report(&report)
    }
}
