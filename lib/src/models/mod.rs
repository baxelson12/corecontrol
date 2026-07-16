//! Per-model registry for the Coreliquid family.
//!
//! Each supported AIO lives in its own file and exposes a single `SPEC`
//! constant; they are aggregated into `KNOWN_MODELS`. Adding a cooler is a new
//! file plus one line in that array. Detection and configuration read from the
//! registry, so no other code changes when the family grows.

pub mod k360;
pub mod s280;
pub mod s360;

use hidapi::HidApi;

use crate::error::ControllerError;

/// USB vendor ID shared by every Coreliquid in this family.
pub(crate) const VENDOR_ID: u16 = 0x0db0;

/// The most radiator fans any known model carries.
pub const MAX_RADIATOR_FANS: usize = 3;

/// A known cooler model and the few attributes that vary between variants.
#[derive(Debug, Clone, Copy)]
pub struct ModelSpec {
    /// USB product ID that identifies this model.
    pub product_id: u16,
    /// Human-readable model name, for display and confirmation prompts.
    pub name: &'static str,
    /// Number of physical radiator fans the model carries. Used for display and
    /// status; configuration writes cover every fan slot regardless.
    pub radiator_fans: usize,
}

/// Every model this controller recognizes, aggregated from the per-model files.
pub(crate) const KNOWN_MODELS: [ModelSpec; 3] = [s280::SPEC, s360::SPEC, k360::SPEC];

// Compile-time invariants over the registry.
const _: () = assert!(VENDOR_ID != 0, "vendor id must be set");
const _: () = assert!(!KNOWN_MODELS.is_empty(), "model table must not be empty");
const _: () = assert!(
    MAX_RADIATOR_FANS >= 1,
    "a model must have at least one radiator fan"
);

/// Returns every model this controller can drive, for display or logging.
pub fn known_models() -> &'static [ModelSpec] {
    &KNOWN_MODELS
}

/// Enumerates the recognized models currently attached, creating a private
/// HID context for the scan. An application calls this at startup to learn
/// what is in the machine before opening anything.
///
/// # Errors
/// Returns `ControllerError::Hid` when the HID context cannot be created.
pub fn detect_attached() -> Result<Vec<ModelSpec>, ControllerError> {
    let api = HidApi::new()?;
    let attached: Vec<ModelSpec> = available_devices(&api).collect();
    debug_assert!(
        attached.len() <= KNOWN_MODELS.len(),
        "detection yielded more models than the registry holds"
    );

    Ok(attached)
}

/// Yields each recognized model currently attached, at most once per model.
/// An application uses this to present a device list for the user to confirm.
pub fn available_devices(api: &HidApi) -> impl Iterator<Item = ModelSpec> + '_ {
    KNOWN_MODELS.iter().copied().filter(move |model| {
        api.device_list()
            .any(|info| info.vendor_id() == VENDOR_ID && info.product_id() == model.product_id)
    })
}
