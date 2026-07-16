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

impl std::fmt::Display for ControllerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ControllerError::DeviceNotFound => {
                write!(f, "no recognized Coreliquid cooler is attached")
            }
            ControllerError::Hid(error) => write!(f, "HID transport failed: {error}"),
            ControllerError::UnexpectedResponse(command) => {
                write!(f, "reply carried unexpected command byte {command:#04x}")
            }
            ControllerError::ShortWrite(written) => {
                write!(f, "write transferred only {written} bytes")
            }
            ControllerError::ShortRead(read) => write!(f, "read returned only {read} bytes"),
        }
    }
}

impl std::error::Error for ControllerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ControllerError::Hid(error) => Some(error),
            _ => None,
        }
    }
}
