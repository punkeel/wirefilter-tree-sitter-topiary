use std::{env, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let source_dir = manifest_dir.join("src");
    let parser = source_dir.join("parser.c");
    let scanner = source_dir.join("scanner.c");

    cc::Build::new()
        .include(&source_dir)
        .file(&parser)
        .file(&scanner)
        .compile("tree-sitter-wirefilter");

    println!("cargo:rerun-if-changed={}", source_dir.display());
}
