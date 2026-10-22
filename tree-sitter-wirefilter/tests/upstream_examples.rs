//! Upstream examples are offline fixtures; snapshots include tree shape and every
//! leaf token, including anonymous operators, punctuation, and literal contents.
use serde::Deserialize;
use std::{collections::BTreeSet, fmt::Write, path::Path};

#[derive(Deserialize)]
struct Corpus {
    upstream: Upstream,
    cases: Vec<Case>,
}
#[derive(Deserialize)]
struct Upstream {
    revision: String,
}
#[derive(Deserialize)]
struct Case {
    source: String,
    must_parse: bool,
    origins: Vec<Origin>,
}
#[derive(Deserialize)]
struct Origin {
    path: String,
    line: usize,
    context: String,
}

fn corpus() -> Corpus {
    serde_json::from_str(include_str!("upstream-examples/cases.json")).unwrap()
}

fn snapshot(parser: &mut tree_sitter::Parser, case: &Case) -> String {
    let tree = parser.parse(&case.source, None).unwrap();
    let root = tree.root_node();
    if case.must_parse {
        // has_error includes missing nodes, not just explicit ERROR nodes.
        assert!(
            !root.has_error(),
            "upstream expression rejected: {:?}\n{}",
            case.source,
            root.to_sexp()
        );
    }
    let mut tokens = Vec::new();
    let mut pending = vec![root];
    while let Some(node) = pending.pop() {
        if node.child_count() == 0 {
            tokens.push((node.kind(), node.utf8_text(case.source.as_bytes()).unwrap()));
        } else {
            let mut cursor = node.walk();
            let children: Vec<_> = node.children(&mut cursor).collect();
            pending.extend(children.into_iter().rev());
        }
    }
    format!(
        "{}\n{}\n{}",
        serde_json::to_string(&case.source).unwrap(),
        root.to_sexp(),
        serde_json::to_string(&tokens).unwrap()
    )
}

#[test]
fn upstream_examples_match_cst_and_literal_snapshots() {
    let corpus = corpus();
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&tree_sitter_wirefilter::LANGUAGE.into())
        .unwrap();
    let mut seen = BTreeSet::new();
    let mut actual = String::new();
    for case in &corpus.cases {
        assert!(
            seen.insert(&case.source),
            "duplicate expression: {:?}",
            case.source
        );
        assert!(
            !case.origins.is_empty(),
            "missing provenance: {:?}",
            case.source
        );
        writeln!(actual, "{}\n", snapshot(&mut parser, case)).unwrap();
    }
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/upstream-examples/trees.snap");
    if std::env::var("UPDATE_UPSTREAM_SNAPSHOTS").as_deref() == Ok("1") {
        std::fs::write(&path, &actual).unwrap();
    }
    let expected = std::fs::read_to_string(path).expect("checked-in upstream tree snapshots");
    let expected: Vec<_> = expected.trim_end().split("\n\n").collect();
    let actual: Vec<_> = actual.trim_end().split("\n\n").collect();
    assert_eq!(
        actual.len(),
        expected.len(),
        "upstream snapshot count changed"
    );
    for (case, (actual, expected)) in corpus.cases.iter().zip(actual.iter().zip(&expected)) {
        assert_eq!(
            actual, expected,
            "upstream CST/token snapshot changed for {:?}",
            case.source
        );
    }
    println!(
        "{} upstream examples, {} required clean parses; all CST/token snapshots match",
        corpus.cases.len(),
        corpus.cases.iter().filter(|c| c.must_parse).count()
    );
}

#[test]
#[ignore = "requires WIREFILTER_UPSTREAM at the pinned revision"]
fn upstream_example_provenance_matches_checkout() {
    let corpus = corpus();
    let root = std::env::var("WIREFILTER_UPSTREAM")
        .expect("set WIREFILTER_UPSTREAM to the pinned checkout");
    let revision = std::process::Command::new("git")
        .args(["-C", &root, "rev-parse", "HEAD"])
        .output()
        .unwrap();
    assert!(revision.status.success());
    assert_eq!(
        String::from_utf8(revision.stdout).unwrap().trim(),
        corpus.upstream.revision
    );
    for case in corpus.cases {
        for origin in case.origins {
            let source = std::fs::read_to_string(Path::new(&root).join(&origin.path)).unwrap();
            assert_eq!(
                source.lines().nth(origin.line - 1).unwrap().trim(),
                origin.context,
                "upstream source moved: {}:{} ({:?})",
                origin.path,
                origin.line,
                case.source
            );
        }
    }
}
