#[cfg(target_arch = "wasm32")]
use topiary_core::{formatter_str, Language, Operation, TopiaryQuery};
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

/// Run the real Topiary engine with the repository's formatting query.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn format_wirefilter(source: &str, grammar: JsValue, query: &str) -> Result<String, JsError> {
    let grammar = topiary_web_tree_sitter_sys::Language::from(grammar).into();
    let formatting_query = TopiaryQuery::new(&grammar, query)
        .map_err(|e| JsError::new(&format!("{e:?}")))?;
    let language = Language {
        name: "wirefilter".into(), grammar, formatting_query,
        injection_query: None, indent: Some("    ".into()),
    };
    let mut output = Vec::new();
    formatter_str(source, &mut output, &language, Operation::Format {
        skip_idempotence: false, tolerate_parsing_errors: false, skip_stage: None,
    }, None).map_err(|e| JsError::new(&format!("{e:?}")))?;
    String::from_utf8(output).map_err(|e| JsError::new(&e.to_string()))
}
