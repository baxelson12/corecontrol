//! Diagnostic: lists every MSI HID interface hidapi can see.
//!
//! Run this when the controller reports `DeviceNotFound` or when a device does
//! not seem to respond. It confirms whether hidapi can see the cooler at all,
//! and shows how many separate HID collections it exposes (a composite device
//! can present several). It is read-only: it never opens or writes to the
//! device, so it cannot change fan state.
//!
//! Build and run from the crate root: `cargo run --bin list_devices`.

use hidapi::{DeviceInfo, HidApi};

/// USB vendor ID for Micro-Star International.
const MSI_VENDOR_ID: u16 = 0x0db0;
/// Upper bound on how many MSI interfaces could plausibly be attached.
const MAX_PLAUSIBLE_INTERFACES: usize = 64;
/// Process exit code for a successful run.
const EXIT_OK: i32 = 0;
/// Process exit code for a failed run.
const EXIT_FAILURE: i32 = 1;

// Compile-time invariants over the constants above.
const _: () = assert!(MSI_VENDOR_ID != 0, "vendor id must be set");
const _: () = assert!(
    MAX_PLAUSIBLE_INTERFACES > 0,
    "interface bound must be positive"
);

/// Prints the identifying fields of one HID interface.
fn print_interface(info: &DeviceInfo) {
    assert_eq!(info.vendor_id(), MSI_VENDOR_ID, "printing a non-MSI device");
    assert!(!info.path().to_bytes().is_empty(), "device path is empty");
    let product = info.product_string().unwrap_or("<unknown>");
    println!(
        "  pid={:#06x}  interface={}  usage_page={:#06x}  usage={:#06x}  product=\"{product}\"",
        info.product_id(),
        info.interface_number(),
        info.usage_page(),
        info.usage(),
    );
    println!("    path: {:?}", info.path());
}

/// Prints every MSI HID interface hidapi enumerates and returns how many there
/// were. The loop iterates hidapi's existing device list, printing each match.
fn list_msi_interfaces(api: &HidApi) -> usize {
    let mut count: usize = 0;
    for info in api.device_list() {
        if info.vendor_id() == MSI_VENDOR_ID {
            print_interface(info);
            count += 1;
        }
    }
    assert!(
        count <= MAX_PLAUSIBLE_INTERFACES,
        "implausibly many MSI interfaces"
    );

    count
}

/// Prints a one-line summary interpreting the interface count.
fn report_count(count: usize) {
    assert!(count <= MAX_PLAUSIBLE_INTERFACES, "count out of range");
    if count == 0 {
        println!("No MSI (0x0db0) HID interfaces found. hidapi cannot see the cooler.");
        println!("Check that the cooler's USB header is connected and MSI Center is closed.");
    } else {
        println!("Found {count} MSI HID interface(s). Note the interface and usage of each.");
    }
}

/// Enumerates MSI HID interfaces and prints a summary.
fn main() {
    let api = match HidApi::new() {
        Ok(api) => api,
        Err(error) => {
            eprintln!("Could not initialize hidapi: {error:?}");
            std::process::exit(EXIT_FAILURE);
        }
    };
    let count = list_msi_interfaces(&api);
    assert!(
        count <= MAX_PLAUSIBLE_INTERFACES,
        "interface count out of range"
    );
    report_count(count);
    std::process::exit(EXIT_OK);
}
