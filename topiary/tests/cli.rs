use std::{
    io::Write,
    process::{Command, Output, Stdio},
};

fn run(args: &[&str], input: &str) -> Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_wirefilter-fmt"))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();
    child.wait_with_output().unwrap()
}

#[test]
fn invalid_input_has_a_location_and_no_stdout() {
    let output = run(&[], "(a");
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("1:3"));
}

#[test]
fn stdin_and_file_input_match_the_library() {
    let input = "a and b";
    let expected = wirefilter_format::format(input).unwrap();
    for args in [&[][..], &["-"][..]] {
        let output = run(args, input);
        assert!(output.status.success());
        assert_eq!(output.stdout, expected.as_bytes());
    }
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/examples.wirefilter"
    );
    let output = run(&[path], "");
    assert!(output.status.success());
    assert_eq!(
        output.stdout,
        wirefilter_format::format(&std::fs::read_to_string(path).unwrap())
            .unwrap()
            .as_bytes()
    );
}

#[test]
fn options_and_argument_errors_do_not_need_input() {
    assert!(String::from_utf8_lossy(&run(&["--help"], "").stdout).contains("Usage: wirefilter-fmt"));
    assert_eq!(run(&["--version"], "").stdout, b"wirefilter-fmt 0.1.0\n");
    let output = run(&["-", "extra"], "");
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
}
