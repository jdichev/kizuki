#[cfg(feature = "napi-export")]
extern crate napi_build;

fn main() {
    #[cfg(feature = "napi-export")]
    napi_build::setup();
}
