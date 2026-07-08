//! MSI MEG Coreliquid S280 (USB 0db0:6a04).
//!
//! Two 140 mm radiator fans. Channel mapping is capture-confirmed on this
//! model: radiator = slot 0, waterblock = slot 3, pump = slot 4; slots 1-2 are
//! unmapped and written for uniformity only.

use super::ModelSpec;

/// Device specification for the MEG Coreliquid S280.
pub const SPEC: ModelSpec = ModelSpec {
    product_id: 0x6a04,
    name: "MSI MEG Coreliquid S280",
    radiator_fans: 2,
};
