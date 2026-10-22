; Tree-sitter editor highlighting (independent of Topiary formatting).
(identifier) @variable
(comparison_operator) @operator
[
  "and" "&&" "xor" "^^" "or" "||" "not" "!"
] @keyword.operator
(quoted_string) @string
(regex_string) @string
(raw_string) @string
(byte_string) @string.special
(list_reference) @constant
(integer) @number
(ip_address) @number
[
  "(" ")" "[" "]" "{" "}"
] @punctuation.bracket
"," @punctuation.delimiter
".." @operator
"*" @operator
