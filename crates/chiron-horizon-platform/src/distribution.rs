//! Distribution is deliberately unavailable until a Chiron Horizon release channel exists.
pub fn ensure_enabled() -> Result<(), String> {
    Err("Chiron Horizon downloads and automatic updates are not configured. Download a verified installer from the Chiron Horizon GitHub releases.".into())
}
#[cfg(test)]
mod tests {
    #[test]
    fn distribution_is_disabled() {
        assert!(super::ensure_enabled().is_err());
    }
}
