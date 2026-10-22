; Cloudflare Wirefilter / Topiary formatting rules.
;
; All whitespace is reconstituted from captures; the rules below therefore
; cover delimiters, boolean and comparison operators, call arguments, lists,
; index operators, and whitespace-separated set items.

; Opaque byte / regex / raw-string contents are never rewritten.
[
  (quoted_string)
  (regex_string)
  (raw_string)
  (byte_string)
  (ip_address)
  (list_reference)
] @leaf

; Comparisons, membership, bitwise tests and byte-string matching.
(comparison_operator) @prepend_space @append_space

; Boolean chains always break before the operator, including one-line input.
; This is a structural layout policy, not a line-width heuristic.
(logical_expression
  ["and" "&&" "xor" "^^" "or" "||"] @prepend_hardline @append_space
)

; Unary keywords require a space; symbolic ! binds tightly.
(unary_expression "not" @append_space)
(unary_expression "!" @append_antispace)

; Calls stay compact unless an argument contains a boolean chain, a grouped
; boolean chain, a nested unary chain, or a nested call. Delimiters use
; explicit structural rules so a newly inserted newline cannot change the
; formatting policy on a second pass.
(argument_list
  "(" @prepend_antispace @append_antispace
  ")" @prepend_antispace
)
(argument_list "," @prepend_antispace @append_space)
(argument_list
  "(" @append_hardline @append_indent_start
  [
    (logical_expression)
    (parenthesized_expression (logical_expression))
    (unary_expression (parenthesized_expression (logical_expression)))
    (unary_expression
      (unary_expression (parenthesized_expression (logical_expression))))
    (reference_expression (argument_list))
  ]
  ")" @prepend_hardline @prepend_indent_end
)
; Every comma is either before or after a logical argument. Cover both orders
; so all arguments of such a call occupy separate lines.
(argument_list (logical_expression) "," @append_hardline)
(argument_list "," @append_hardline (logical_expression))
; If a nested call or grouped boolean argument expands the call, put every
; comma in that call on its own argument line as well.
(argument_list
  (_)*
  [
    (parenthesized_expression (logical_expression))
    (unary_expression (parenthesized_expression (logical_expression)))
    (unary_expression
      (unary_expression (parenthesized_expression (logical_expression))))
    (reference_expression (argument_list))
  ]
  (_)* "," @append_hardline
)
(argument_list
  (_)* "," @append_hardline (_)*
  [
    (parenthesized_expression (logical_expression))
    (unary_expression (parenthesized_expression (logical_expression)))
    (unary_expression
      (unary_expression (parenthesized_expression (logical_expression))))
    (reference_expression (argument_list))
  ]
  (_)*
)

; Expand groups that contain a boolean chain; keep simple groups compact.
; Compact outer wrappers also stay stable around an expanded inner group.
(parenthesized_expression
  "(" @append_antispace
  ")" @prepend_antispace
)
(parenthesized_expression
  "(" @append_hardline @append_indent_start
  (logical_expression)
  ")" @prepend_hardline @prepend_indent_end
)

; Indexed fields and calls: headers["name"][*], without internal spaces.
(index_access
  "[" @prepend_antispace @append_antispace
  "]" @prepend_antispace
)

; A nonempty set is rendered with spaces next to braces.
(set_literal
  "{" @append_spaced_softline @append_indent_start
  (_)
  "}" @prepend_indent_end @prepend_spaced_softline
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
