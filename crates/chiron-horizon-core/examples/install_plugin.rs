//! One-shot plugin installer for local Chiron Horizon app stores:
//!   cargo run -p chiron-horizon-core --example install_plugin -- <plugins-root> <chiron_horizonp> <app-version> [--rollback-plugin <id>]
use chiron_horizon_core::plugins::{PluginInstallPolicy, PluginPackageInstaller};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 3 {
        eprintln!("usage: install_plugin <plugins-root> <package.chiron-horizonp> <app-version>");
        std::process::exit(2);
    }
    let installer = PluginPackageInstaller::new(std::path::PathBuf::from(&args[0]), &args[2]).expect("installer");
    match installer.install_file(std::path::Path::new(&args[1]), PluginInstallPolicy::LocalDevelopment) {
        Ok(result) => {
            let response = result.response();
            println!(
                "installed {} v{} (previous: {:?}, signature: {:?}, sha256: {})",
                response.plugin.manifest.id,
                response.plugin.manifest.version,
                response.previous_version,
                response.signature,
                response.package_sha256
            );
        }
        Err(error) => {
            eprintln!("install failed: {error}");
            std::process::exit(1);
        }
    }
}
