//! Opening a detected cooler and applying or reading profiles.

use hidapi::{HidApi, HidDevice};

use crate::error::ControllerError;
use crate::models::{ModelSpec, VENDOR_ID, available_devices};
use crate::protocol::{
    CMD_GET_DUTY, CMD_GET_TEMP, CMD_PUSH_CPU, CMD_STATUS, FanConfig, FanStatus, REPORT_LEN,
    TEMP_CEILING, WRITE_PREFIX, build_command, parse_status,
};

/// HID report id of the feature report read during the connect handshake.
const HANDSHAKE_FEATURE_ID: u8 = 0x52;
/// Length of the feature report the device returns for report id 0x52.
const HANDSHAKE_FEATURE_LEN: usize = 185;
/// Read timeout for a reply, in milliseconds.
const READ_TIMEOUT_MS: i32 = 500;

// Compile-time invariants over the handshake constants.
const _: () = assert!(
    HANDSHAKE_FEATURE_ID != 0,
    "handshake feature id must be set"
);
const _: () = assert!(
    HANDSHAKE_FEATURE_LEN > 0,
    "handshake feature length must be positive"
);
const _: () = assert!(READ_TIMEOUT_MS > 0, "read timeout must be positive");

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
        assert!(spec.radiator_fans >= 1, "model must have a radiator fan");
        assert!(spec.product_id != 0, "model has no product id");
        let device = api.open(VENDOR_ID, spec.product_id)?;
        let info = device.get_device_info()?;
        assert_eq!(
            info.product_id(),
            spec.product_id,
            "opened the wrong device"
        );

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
        assert!(
            spec.radiator_fans >= 1,
            "detected model has no radiator fan"
        );
        assert!(spec.product_id != 0, "detected model has no product id");

        Cooler::open_with(&api, spec)
    }

    /// Returns the detected model's spec, for display.
    pub fn model(&self) -> ModelSpec {
        assert!(self.spec.radiator_fans >= 1, "model has no radiator fan");
        assert!(self.spec.product_id != 0, "model has no product id");

        self.spec
    }

    /// Returns the profile this controller last applied, or `None` if none has
    /// been applied yet. This is a software shadow, not a live device read.
    pub fn current_profile(&self) -> Option<&FanConfig> {
        assert!(self.spec.product_id != 0, "cooler in an invalid state");
        assert!(self.spec.radiator_fans >= 1, "cooler in an invalid state");

        self.current.as_ref()
    }

    /// Builds a fresh configuration with safe defaults for editing.
    pub fn new_config(&self) -> FanConfig {
        assert!(self.spec.radiator_fans >= 1, "model has no radiator fan");
        assert!(self.spec.product_id != 0, "cooler in an invalid state");

        FanConfig::new()
    }

    /// Runs the connect handshake MSI Center performs before it drives the
    /// fans: a feature-report read followed by reads of the current fan
    /// configuration. Call once after opening.
    pub fn initialize(&self) -> Result<(), ControllerError> {
        assert!(self.spec.product_id != 0, "cooler in an invalid state");
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
        assert_eq!(
            buffer[0], HANDSHAKE_FEATURE_ID,
            "feature request id not set"
        );
        let read = self.device.get_feature_report(&mut buffer)?;
        assert!(read <= buffer.len(), "feature read overran the buffer");

        Ok(())
    }

    /// Sends a read-request command and consumes the 64-byte reply.
    fn read_config(&self, command: u8) -> Result<(), ControllerError> {
        assert!(
            command == CMD_GET_DUTY || command == CMD_GET_TEMP,
            "not a config-read command: {command:#x}"
        );
        let request = build_command(command, &[]);
        self.send_report(&request)?;
        let mut reply = [0u8; REPORT_LEN];
        let read = self.device.read_timeout(&mut reply, READ_TIMEOUT_MS)?;
        assert!(read <= REPORT_LEN, "config read overran the buffer");
        if read < REPORT_LEN {
            return Err(ControllerError::ShortRead(read));
        }

        Ok(())
    }

    /// Writes one fully-formed report to the device, verifying the transfer.
    fn send_report(&self, buffer: &[u8; REPORT_LEN]) -> Result<(), ControllerError> {
        assert_eq!(buffer[0], WRITE_PREFIX, "report missing its prefix byte");
        assert_eq!(buffer.len(), REPORT_LEN, "report wrong length");
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
        assert_eq!(request[1], CMD_STATUS, "status request mislabelled");
        self.send_report(&request)?;
        let mut reply = [0u8; REPORT_LEN];
        let read = self.device.read_timeout(&mut reply, READ_TIMEOUT_MS)?;
        assert!(read <= REPORT_LEN, "read overran the buffer");
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
        assert_eq!(
            duty_report[1],
            crate::protocol::CMD_SET_DUTY,
            "duty report mislabelled"
        );
        assert_eq!(
            temp_report[1],
            crate::protocol::CMD_SET_TEMP,
            "temp report mislabelled"
        );
        self.send_report(&duty_report)?;
        self.send_report(&temp_report)?;
        self.current = Some(config.clone());

        Ok(())
    }

    /// Forwards the current CPU temperature so the device's curves keep
    /// tracking. Must be called on a steady cadence by the caller's timer;
    /// frequency only drives the LCD readout and is left zero.
    pub fn push_cpu_temp(&self, temp_c: u8) -> Result<(), ControllerError> {
        assert!(
            temp_c <= TEMP_CEILING,
            "cpu temperature implausible: {temp_c}"
        );
        let payload = [0u8, 0u8, temp_c, 0u8];
        let report = build_command(CMD_PUSH_CPU, &payload);
        assert_eq!(report[1], CMD_PUSH_CPU, "cpu-push command misplaced");

        self.send_report(&report)
    }
}
