//! Distribution is deliberately unavailable until a Gaussian release channel exists.
pub fn ensure_enabled() -> Result<(), String> {
    Err("Gauss Horizon downloads and automatic updates are not available in 0.1.0. Use your supplied build.".into())
}
#[cfg(test)]
mod tests {
    #[test]
    fn distribution_is_disabled() {
        assert!(super::ensure_enabled().is_err());
    }
}
