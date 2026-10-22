//! Optional Topiary formatting for the syntax-only Wirefilter grammar.

use topiary_core::{formatter_str, Language, Operation, TopiaryQuery};
use tree_sitter::Parser;

/// A syntax, formatting, or integrity error.
pub type Error = Box<dyn std::error::Error + Send + Sync>;

/// Format an expression, preserving its concrete tree and token spellings.
///
/// This checks syntax and idempotence, not names or types against a Wirefilter
/// Scheme. The grammar and default four-space formatting policy are embedded.
pub fn format(source: &str) -> Result<String, Error> {
    format_with_query(source, include_str!("../queries/formatting.scm"))
}

fn format_with_query(source: &str, query: &str) -> Result<String, Error> {
    let before = signature(source)?;
    let grammar = tree_sitter_wirefilter::LANGUAGE.into();
    let language = Language {
        formatting_query: TopiaryQuery::new(&grammar, query)
            .map_err(|error| format!("invalid formatting query: {error}"))?,
        name: "wirefilter".into(),
        grammar,
        injection_query: None,
        indent: Some("    ".into()),
    };
    let mut output = Vec::new();
    formatter_str(
        source,
        &mut output,
        &language,
        Operation::Format {
            skip_idempotence: false,
            tolerate_parsing_errors: false,
            skip_stage: None,
        },
        None,
    )
    .map_err(|error| format!("formatting failed: {error}"))?;
    let output = String::from_utf8(output)?;
    if before != signature(&output)? {
        return Err("formatting changed expression syntax or token contents".into());
    }
    Ok(output)
}

#[derive(Debug, PartialEq)]
struct Node<'a> {
    kind: u16,
    named: bool,
    extra: bool,
    field: Option<&'static str>,
    children: usize,
    text: Option<&'a str>,
}

// Preorder plus child counts preserves tree shape. Include anonymous tokens and
// field names; borrow leaf contents so literal bytes are compared without copies.
fn signature(source: &str) -> Result<Vec<Node<'_>>, Error> {
    let mut parser = Parser::new();
    parser.set_language(&tree_sitter_wirefilter::LANGUAGE.into())?;
    let tree = parser.parse(source, None).ok_or("could not parse input")?;
    if tree.root_node().named_child_count() == 0 {
        return Err("expected a Wirefilter expression".into());
    }
    let mut cursor = tree.walk();
    let mut nodes = Vec::new();
    loop {
        let node = cursor.node();
        if node.is_error() || node.is_missing() {
            let position = node.start_position();
            return Err(format!(
                "syntax error at {}:{}: {} {}",
                position.row + 1,
                position.column + 1,
                if node.is_missing() {
                    "missing"
                } else {
                    "unexpected"
                },
                node.kind()
            )
            .into());
        }
        nodes.push(Node {
            kind: node.kind_id(),
            named: node.is_named(),
            extra: node.is_extra(),
            field: cursor.field_name(),
            children: node.child_count(),
            text: if node.child_count() == 0 {
                Some(node.utf8_text(source.as_bytes())?)
            } else {
                None
            },
        });
        if cursor.goto_first_child() {
            continue;
        }
        while !cursor.goto_next_sibling() {
            if !cursor.goto_parent() {
                return Ok(nodes);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{format_with_query, signature};

    #[test]
    fn formatting_rejects_stable_rules_that_change_tokens() {
        let uppercase = format!(
            "{}\n(quoted_string) @upper_case",
            include_str!("../queries/formatting.scm")
        );
        for (source, query) in [("a and b", ""), ("body eq \"keep me\"", uppercase.as_str())] {
            assert_eq!(
                format_with_query(source, query).unwrap_err().to_string(),
                "formatting changed expression syntax or token contents"
            );
        }
    }

    #[test]
    fn integrity_guard_preserves_operators_literals_grouping_and_completeness() {
        for (source, output) in [
            ("a and b", "a or b\n"),
            ("body eq \"keep me\"", "body eq \"KEEP ME\"\n"),
            ("(a)", "a\n"),
            ("a", "(a\n"),
            ("a", "a\nb\n"),
        ] {
            let before = signature(source).unwrap();
            assert!(signature(output).map_or(true, |after| before != after));
        }
        assert_eq!(
            signature("a and b").unwrap(),
            signature("a\nand b\n").unwrap()
        );
    }
}
