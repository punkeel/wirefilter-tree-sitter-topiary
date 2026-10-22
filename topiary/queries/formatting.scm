; Cloudflare Wirefilter / Topiary formatting rules.
;
; All whitespace is reconstituted from captures; the rules below therefore
; cover delimiters, boolean and comparison operators, call arguments, lists,
; index operators, and whitespace-separated set items.

; Opaque byte / regex / raw-string contents are never rewritten.
[
  (quoted_string)
  (raw_string)
  (byte_string)
  (ip_address)
  (list_reference)
] @leaf

; Comparisons, membership, bitwise tests and byte-string matching.
(comparison_operator) @prepend_space @append_space

; Break boolean chains when the expression needs multiple lines. The spaced
; softline produces a plain space for compact expressions.
(logical_expression
  ["and" "&&" "xor" "^^" "or" "||"] @prepend_spaced_softline @append_space
)

; Unary keywords require a space; symbolic ! binds tightly.
(unary_expression "not" @append_space)
(unary_expression "!" @append_antispace)

; Calls and quantifiers: name(arg1, arg2). Commas are only used here; a
; Wirefilter set is NOT comma separated.
(argument_list
  "(" @prepend_antispace @append_empty_softline @append_indent_start
  ")" @prepend_empty_softline @prepend_indent_end @prepend_antispace
)
(argument_list "," @prepend_antispace @append_spaced_softline)

; Grouped subexpressions: (a and b), indenting only if multiline.
(parenthesized_expression
  "(" @append_empty_softline @append_indent_start
  ")" @prepend_empty_softline @prepend_indent_end
)

; Indexed fields and calls: headers["name"][*], without internal spaces.
(index_access
  "[" @prepend_antispace @append_antispace
  "]" @prepend_antispace
)

; A nonempty set is rendered with spaces next to braces.
(set_literal
  "{" @append_space @append_indent_start
  (_)
  "}" @prepend_indent_end @prepend_space
)

; Preserve a separating space (or soft line break) between consecutive set
; elements, regardless of whether they are bytes, integers, IPs or ranges.
(set_literal
  (_) @append_spaced_softline
  .
  (_)
)

; Range bounds must not be separated from '..'.
(range_literal ".." @prepend_antispace @append_antispace)
