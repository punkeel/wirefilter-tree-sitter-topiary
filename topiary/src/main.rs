use std::{
    env, fs,
    io::{self, Read, Write},
    process,
};

fn main() {
    if let Err(error) = run() {
        eprintln!("wirefilter-fmt: {error}");
        process::exit(1);
    }
}

fn run() -> Result<(), wirefilter_format::Error> {
    let mut args = env::args_os().skip(1);
    let path = args.next();
    if args.next().is_some() {
        return Err("expected at most one input path; see --help".into());
    }
    let mut source = String::new();
    match path.as_deref() {
        Some(arg) if arg == "--help" || arg == "-h" => {
            println!("Usage: wirefilter-fmt [PATH|-]\n\nReads PATH or stdin; writes formatted output to stdout.\nOptions: --help, --version");
            return Ok(());
        }
        Some(arg) if arg == "--version" => {
            println!("wirefilter-fmt {}", env!("CARGO_PKG_VERSION"));
            return Ok(());
        }
        None => {
            io::stdin().read_to_string(&mut source)?;
        }
        Some(arg) if arg == "-" => {
            io::stdin().read_to_string(&mut source)?;
        }
        Some(path) => source = fs::read_to_string(path)?,
    }
    let output = wirefilter_format::format(&source)?;
    io::stdout().lock().write_all(output.as_bytes())?;
    Ok(())
}
