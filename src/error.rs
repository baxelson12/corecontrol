//! Error type shared across the crate.

/// Failures that can arise while talking to a cooler.
#[derive(Debug)]
pub enum ControllerError {
    /// No recognized Coreliquid is attached.
    DeviceNotFound,
    /// The `hidapi` layer failed while opening or transferring.
    Hid(hidapi::HidError),
    /// A reply arrived but carried an unexpected command byte.
    UnexpectedResponse(u8),
    /// A write transferred no bytes.
    ShortWrite(usize),
    /// A read returned fewer bytes than a full report.
    ShortRead(usize),
}

impl From<hidapi::HidError> for ControllerError {
    fn from(error: hidapi::HidError) -> Self {
        ControllerError::Hid(error)
    }
}
