use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_wirefilter() -> *const ();
}

/// The Tree-sitter language for Cloudflare Wirefilter expressions.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_wirefilter) };

/// The Tree-sitter highlighting query for Wirefilter.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

#[cfg(test)]
mod tests {
    use super::LANGUAGE;

    #[test]
    fn parses_a_wirefilter_expression() {
        let mut parser = tree_sitter::Parser::new();
        let language = LANGUAGE.into();
        parser.set_language(&language).unwrap();

        let tree = parser.parse(r#"http.host eq "example.com""#, None).unwrap();

        assert!(!tree.root_node().has_error(), "{tree:?}");
        assert_eq!(tree.root_node().kind(), "source_file");
    }
}
