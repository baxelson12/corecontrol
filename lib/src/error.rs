//! Error type shared across the crate.

use thiserror::Error;

/// Failures that can arise while talking to a cooler.
#[derive(Debug, Error)]
pub enum ControllerError {
    /// No recognized Coreliquid is attached.
    #[error("no recognized Coreliquid cooler is attached")]
    DeviceNotFound,
    /// The `hidapi` layer failed while opening or transferring.
    #[error("HID transport failed: {0}")]
    Hid(#[from] hidapi::HidError),
    /// A reply arrived but carried an unexpected command byte.
    #[error("reply carried unexpected command byte {0:#04x}")]
    UnexpectedResponse(u8),
    /// A fan curve was rejected during validation, with the reason.
    #[error("invalid fan curve: {0}")]
    InvalidCurve(&'static str),
    /// A status reading or a temperature parameter was outside plausible
    /// bounds; for readings this suggests a corrupt or misaligned reply.
    #[error("status reading {0} is outside plausible bounds")]
    ImplausibleReading(u16),
    /// A write transferred no bytes.
    #[error("write transferred only {0} bytes")]
    ShortWrite(usize),
    /// A read returned fewer bytes than a full report.
    #[error("read returned only {0} bytes")]
    ShortRead(usize),
}
