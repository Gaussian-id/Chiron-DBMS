#[tokio::main]
async fn main() {
    if let Err(error) = gauss_horizon_tdengine_driver::run().await {
        eprintln!("TDengine driver failed: {error:#}");
        std::process::exit(1);
    }
}
