//! Controller library for the MSI MEG/MPG Coreliquid family of AIO coolers.
//!
//! The crate is organized so that shared behavior and per-model data are
//! separated:
//!
//! - `protocol` — the on-wire report format, fan curves, and configuration
//! - `cooler` — opening a device and applying or reading profiles
//! - `error` — the shared error type
//! - `models` — one small file per supported AIO, aggregated for detection
//!
//! Fan curves must carry between `MIN_CURVE_POINTS` and `MAX_CURVE_POINTS`
//! points; the firmware rejects curves with fewer than four.

mod cooler;
mod error;
pub mod models;
mod protocol;

pub use cooler::Cooler;
pub use error::ControllerError;
pub use models::{ModelSpec, available_devices, detect_attached, known_models};
pub use protocol::{ChannelCurve, FanConfig, FanStatus, MAX_CURVE_POINTS, MIN_CURVE_POINTS};
