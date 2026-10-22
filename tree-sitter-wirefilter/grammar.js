/**
 * Tree-sitter grammar for Cloudflare Wirefilter expressions.
 *
 * Syntax only: Wirefilter's Rust Scheme does type checking and resolves which
 * identifiers are fields versus functions. This grammar does not attempt that.
 *
 * Upstream reference: https://github.com/cloudflare/wirefilter/tree/master/engine/src
 */

const PREC = {
  OR: 1,
  XOR: 2,
  AND: 3,
  NOT: 4,
  COMPARISON: 5,
};

// Lexical IP shapes, not address/range validation. Nonempty hextet groups
// keep compressed addresses and IPv4-mapped IPv6 in a single token.
const IP_ADDRESS = choice(
  /([0-9]{1,3}\.){3}[0-9]{1,3}/,
  /(([0-9a-fA-F]{1,4}:){1,6}(([0-9]{1,3}\.){3}[0-9]{1,3})|((::|([0-9a-fA-F]{1,4}:){1,7}:)([0-9a-fA-F]{1,4}:){0,6}([0-9]{1,3}\.){3}[0-9]{1,3})|(([0-9a-fA-F]{1,4}:){1,7}:([0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4})|(::([0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4})|(([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}))/,
);

const comparison = ($, operator, rhs) => prec(PREC.COMPARISON, seq(
  field('left', $.reference_expression),
  field('operator', alias(operator, $.comparison_operator)),
  field('right', rhs),
));

module.exports = grammar({
  name: 'wirefilter',

  // Wirefilter's skip_space() consumes spaces, CR and LF, but not tabs.
  // Wirefilter does not currently have a comment syntax.
  extras: $ => [/[ \r\n]+/],

  externals: $ => [$.raw_string, $.regex_string, $.quoted_string, $.integer, $._immediate_integer],

  rules: {
    source_file: $ => $._expression,

    _expression: $ => choice(
      $.logical_expression,
      $.unary_expression,
      $.comparison_expression,
      $.parenthesized_expression,
      $.reference_expression,
    ),

    // Upstream precedence (lowest first): or < xor < and.
    logical_expression: $ => choice(
      prec.left(PREC.OR, seq(
        field('left', $._expression),
        field('operator', choice('or', '||')),
        field('right', $._expression),
      )),
      prec.left(PREC.XOR, seq(
        field('left', $._expression),
        field('operator', choice('xor', '^^')),
        field('right', $._expression),
      )),
      prec.left(PREC.AND, seq(
        field('left', $._expression),
        field('operator', choice('and', '&&')),
        field('right', $._expression),
      )),
    ),

    // "not a eq b" means "not (a eq b)". Upstream recognizes the not
    // prefix without a word boundary: notenabled means not enabled.
    unary_expression: $ => prec.right(PREC.NOT, seq(
      field('operator', choice(token(prec(2, 'not')), '!')),
      field('argument', $._expression),
    )),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    // Operator-specific RHS syntax is independent of the Scheme. Type checking
    // remains upstream's job, but e.g. `in 1` and `contains {"a"}` are not valid
    // spellings for any field type.
    comparison_expression: $ => choice(
      comparison($, $._ordering_operator, choice($._scalar_literal, alias($._rhs_reference, $.reference_expression))),
      comparison($, $._membership_operator, choice($.set_literal, $.list_reference)),
      comparison($, $._contains_operator, $._byte_literal),
      comparison($, $._wildcard_operator, choice($.quoted_string, $.raw_string)),
      comparison($, $._regex_operator, choice($.regex_string, $.raw_string)),
      comparison($, $._integer_operator, choice($.integer, alias($._rhs_reference, $.reference_expression))),
    ),

    _ordering_operator: $ => choice(
      'eq', '==', 'ne', '!=', 'gt', '>', 'ge', '>=', 'lt', '<', 'le', '<=',
    ),
    _membership_operator: $ => 'in',
    _contains_operator: $ => 'contains',
    _wildcard_operator: $ => choice('wildcard', 'strict wildcard'),
    _regex_operator: $ => choice('matches', '~'),
    _integer_operator: $ => choice('&', 'bitwise_and'),

    // Both field references and calls can be indexed, e.g. headers["x"][*]
    // and lower(headers["x"])[0].  The Scheme determines whether the name
    // resolves to a registered field or a registered function.
    reference_expression: $ => seq(
      field('name', $.identifier),
      optional(field('arguments', $.argument_list)),
      repeat(field('index', $.index_access)),
    ),

    // Upstream comparison operands only fall back from literal lexing to a
    // reference when they start with an ASCII letter or underscore. This also
    // prevents malformed integers such as 09 from becoming field references.
    _rhs_reference: $ => seq(
      field('name', alias($._rhs_identifier, $.identifier)),
      optional(field('arguments', $.argument_list)),
      repeat(field('index', $.index_access)),
    ),
    _rhs_identifier: $ => /[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*/,

    identifier: $ => /[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*/,

    argument_list: $ => seq(
      '(',
      optional(seq($._argument, repeat(seq(',', $._argument)))),
      ')',
    ),

    // any(...) and all(...) use precisely the same call punctuation; they
    // validate the type of their single argument in Wirefilter's Rust parser.
    _argument: $ => choice($._expression, $._scalar_literal),

    index_access: $ => seq('[', choice($.integer, $.quoted_string, '*'), ']'),

    // Literal sets are whitespace-delimited; commas are NOT valid here.
    set_literal: $ => seq('{', repeat($._set_item), '}'),
    _set_item: $ => choice($.range_literal, alias($._ip_cidr, $.ip_address), $._scalar_literal),

    // Wirefilter supports both integer and IP address ranges with '..'.
    // A full IPv6 address can also match the byte-string token; the range
    // delimiter disambiguates it here. CIDR likewise outranks bare bytes.
    range_literal: $ => choice(
      seq($.integer, token.immediate('..'), alias($._immediate_integer, $.integer)),
      seq(choice($.ip_address, alias($.byte_string, $.ip_address)), token.immediate('..'),
        alias(token.immediate(prec(2, IP_ADDRESS)), $.ip_address)),
    ),

    _byte_literal: $ => choice($.quoted_string, $.raw_string, $.byte_string),
    _scalar_literal: $ => choice($._byte_literal, $.integer, $.ip_address),

    // List names are lowercase ASCII/digit/underscore/dot in the upstream
    // lexer. Internal consecutive dots are valid; leading/trailing dots are not.
    list_reference: $ => token(/\$[a-z0-9_]+(\.+[a-z0-9_]+)*/),

    // Quoted, regex, and raw strings use distinct upstream lexers. The
    // external scanner preserves all contents, including embedded NUL bytes.

    // Hexadecimal byte sequences, e.g. 01:ab:ff.
    byte_string: $ => token(prec(3, /([0-9a-fA-F]{2}:)+[0-9a-fA-F]{2}/)),

    // Wirefilter permits decimal signed integers, 0x hexadecimal and
    // leading-zero octal (negative integers use decimal). Overflow is checked
    // by Wirefilter.

    ip_address: $ => token(prec(2, IP_ADDRESS)),
    _ip_cidr: $ => token(prec(4, seq(IP_ADDRESS, /\/[0-9]{1,3}/))),
  },
});
