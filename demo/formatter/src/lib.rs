#[cfg(target_arch = "wasm32")]
use topiary_core::{formatter, Language, Operation, TopiaryQuery};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// Initialize the web-tree-sitter runtime before loading a grammar or formatting.
///
/// `topiary-web-tree-sitter-sys` installs the `Parser` and `Language` aliases
/// expected by its Rust bindings after `window.TreeSitter.init()` resolves.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn initialize_topiary() -> Result<(), JsError> {
    topiary_web_tree_sitter_sys::TreeSitter::init().await
}

/// Run the real Topiary engine with editable rules and space indentation.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn format_wirefilter(
    source: &str,
    grammar: JsValue,
    query: &str,
    indent: usize,
) -> Result<String, JsError> {
    if !matches!(indent, 2 | 4 | 8) {
        return Err(JsError::new("Indentation must be 2, 4, or 8 spaces."));
    }
    let grammar = topiary_web_tree_sitter_sys::Language::from(grammar).into();
    let formatting_query = TopiaryQuery::new(&grammar, query)
        .map_err(|e| JsError::new(&format!("Invalid formatting query: {e:?}")))?;
    let language = Language {
        name: "wirefilter".into(),
        grammar,
        query: formatting_query,
        indent: Some(" ".repeat(indent)),
    };
    let mut output = Vec::new();
    formatter(
        &mut source.as_bytes(),
        &mut output,
        &language,
        Operation::Format {
            skip_idempotence: false,
            tolerate_parsing_errors: false,
        },
    )
    .map_err(|e| JsError::new(&format!("Formatting rules failed: {e:?}")))?;
    String::from_utf8(output).map_err(|e| JsError::new(&e.to_string()))
}
