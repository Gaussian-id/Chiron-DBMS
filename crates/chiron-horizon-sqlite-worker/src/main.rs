fn main() {
    if let Err(error) = chiron_horizon_sqlite_worker::runtime::run_stdio() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
