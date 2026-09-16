fn main() {
    if let Err(error) = chiron_horizon_plugin_cli::run_cli(std::env::args().skip(1)) {
        chiron_horizon_plugin_cli::print_error(&error);
        std::process::exit(1);
    }
}
