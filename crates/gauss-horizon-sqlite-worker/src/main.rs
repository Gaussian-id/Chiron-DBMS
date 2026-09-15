fn main() {
    if let Err(error) = gauss_horizon_sqlite_worker::runtime::run_stdio() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
