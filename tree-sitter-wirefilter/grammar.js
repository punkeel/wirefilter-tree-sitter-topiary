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

module.exports = grammar({
  name: 'wirefilter',

  // Wirefilter's skip_space() consumes spaces, CR and LF, but not tabs.
  // Wirefilter does not currently have a comment syntax.
  extras: $ => [/[ \r\n]+/],
  word: $ => $.identifier,

  externals: $ => [$.raw_string],

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

    // "not a eq b" is parsed by Wirefilter as "not (a eq b)".
    unary_expression: $ => prec.right(PREC.NOT, seq(
      field('operator', choice('not', '!')),
      field('argument', $._expression),
    )),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    comparison_expression: $ => prec(PREC.COMPARISON, seq(
      field('left', $.reference_expression),
      field('operator', $.comparison_operator),
      field('right', $._comparison_rhs),
    )),

    comparison_operator: $ => choice(
      'eq', '==', 'ne', '!=', 'gt', '>', 'ge', '>=',
      'lt', '<', 'le', '<=',
      'in', 'contains', 'matches', '~',
      'wildcard', 'strict wildcard',
      '&', 'bitwise_and',
    ),

    // Both field references and calls can be indexed, e.g. headers["x"][*]
    // and lower(headers["x"])[0].  The Scheme determines whether the name
    // resolves to a registered field or a registered function.
    reference_expression: $ => seq(
      field('name', $.identifier),
      optional(field('arguments', $.argument_list)),
      repeat(field('index', $.index_access)),
    ),

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

    _comparison_rhs: $ => choice(
      $.set_literal,
      $.list_reference,
      $.range_literal,
      $._scalar_literal,
      $.reference_expression,
    ),

    // Literal sets are whitespace-delimited; commas are NOT valid here.
    set_literal: $ => seq('{', repeat($._set_item), '}'),
    _set_item: $ => choice($.range_literal, $._scalar_literal),

    // Wirefilter supports both integer and IP address ranges with '..'.
    range_literal: $ => choice(
      seq($.integer, '..', $.integer),
      seq($.ip_address, '..', $.ip_address),
    ),

    _scalar_literal: $ => choice(
      $.quoted_string,
      $.raw_string,
      $.byte_string,
      $.integer,
      $.ip_address,
    ),

    // List names are lowercase ASCII/digit/underscore/dot in the upstream
    // lexer, e.g. $office_ips or $my.lists.trusted.
    list_reference: $ => token(/\$[a-z0-9_.]+/),

    // Double-quoted bytes: \", \\, \\xHH and \\OOO are the valid escapes.
    quoted_string: $ => token(/"([^"\\]|\\(["\\]|x[0-9a-fA-F]{2}|[0-7]{3}))*"/),

    // Raw byte strings r"...", r#"..."#, r##"..."## and so on are
    // handled by the external scanner, which balances delimiter hashes.

    // Hexadecimal byte sequences, e.g. 01:ab:ff.
    byte_string: $ => token(prec(3, /([0-9a-fA-F]{2}:)+[0-9a-fA-F]{2}/)),

    // Wirefilter permits decimal signed integers, 0x hexadecimal and
    // leading-zero octal. Type/range validity is checked by Wirefilter.
    integer: $ => token(prec(1, /(0x[0-9a-fA-F]+|-?[0-9]+)/)),

    ip_address: $ => token(prec(2, choice(
      // IPv4, optionally CIDR. IPv4 and IPv6 ranges use a separate '..'.
      /([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?/,
      // IPv6, optionally CIDR, including compressed and IPv4-mapped forms.
      /([0-9a-fA-F]{0,4}:){2,}((([0-9]{1,3}\.){3}[0-9]{1,3})|[0-9a-fA-F]{0,4})(\/[0-9]{1,3})?/,
    ))),
  },
});
