use std::{fs, path::PathBuf};

#[test]
fn all_root_formatter_goldens_match_and_are_idempotent() {
    let tests_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests");
    let mut inputs = fs::read_dir(&tests_dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".input.wirefilter"))
        })
        .collect::<Vec<_>>();
    inputs.sort();

    assert!(!inputs.is_empty(), "no formatter goldens found");
    for input_path in inputs {
        let expected_path = input_path.with_file_name(
            input_path
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .replace(".input.wirefilter", ".expected.wirefilter"),
        );
        let source = fs::read_to_string(&input_path).unwrap();
        let expected = fs::read_to_string(&expected_path).unwrap();
        let actual = wirefilter_format::format(&source)
            .unwrap_or_else(|error| panic!("{}: {error}", input_path.display()));

        assert_eq!(actual, expected, "{}", input_path.display());
        assert_eq!(wirefilter_format::format(&actual).unwrap(), actual);
    }
}

#[test]
fn malformed_and_empty_sources_are_rejected() {
    for source in [
        "",
        "   \n",
        "a and",
        "body eq",
        "(a",
        "ip.src in {1, 2}",
        "body eq \"unterminated",
    ] {
        assert!(
            wirefilter_format::format(source).is_err(),
            "source should be rejected: {source:?}"
        );
    }
}
