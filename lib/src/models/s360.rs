//! MSI MEG Coreliquid S360 (USB 0db0:6a05).
//!
//! Three 120 mm radiator fans. Product ID is confirmed; the three-radiator-slot
//! mapping is inferred from the shared family protocol, not independently
//! verified on this model.

use super::ModelSpec;

/// Device specification for the MEG Coreliquid S360.
pub const SPEC: ModelSpec = ModelSpec {
    product_id: 0x6a05,
    name: "MSI MEG Coreliquid S360",
    radiator_fans: 3,
};
