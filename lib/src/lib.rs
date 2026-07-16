//! Controller library for the MSI MEG/MPG Coreliquid family of AIO coolers.
//!
//! [`Cooler`] is the single entry point: scan for attached models with
//! [`Cooler::scan`], open one with [`Cooler::open`] (or both at once with
//! [`Cooler::detect`]), then apply or read profiles through the instance.
//! [`Cooler::read_profile`] recovers the profile the device is already
//! running, so an application can display it at startup without stored
//! state; `None` means no custom curve is applied. The remaining exports are
//! the data types those calls exchange.
//!
//! Internally, shared behavior and per-model data are separated:
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
mod models;
mod protocol;

pub use cooler::Cooler;
pub use error::ControllerError;
pub use models::ModelSpec;
pub use protocol::{ChannelCurve, FanConfig, FanStatus, MAX_CURVE_POINTS, MIN_CURVE_POINTS};
