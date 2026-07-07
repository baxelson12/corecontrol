//! MSI MPG Coreliquid K360 (USB 0db0:b130).
//!
//! Three 120 mm radiator fans. This is the model mainline liquidctl supports;
//! its status output reports Fan 1/2/3 separately, which is the basis for the
//! three-radiator-slot mapping the family shares.

use super::ModelSpec;

/// Device specification for the MPG Coreliquid K360.
pub const SPEC: ModelSpec = ModelSpec {
    product_id: 0xb130,
    name: "MSI MPG Coreliquid K360",
    radiator_fans: 3,
};
