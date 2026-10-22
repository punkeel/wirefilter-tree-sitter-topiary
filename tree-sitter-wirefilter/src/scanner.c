#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// A scanner is necessary for raw strings with variable-length delimiters and
// regex strings whose closing quote depends on character-class state. Quoted
// bytes retain NUL, and integers enforce maximal digit lexing before radix checks.
enum TokenType { RAW_STRING, REGEX_STRING, QUOTED_STRING, INTEGER, IMMEDIATE_INTEGER };

void *tree_sitter_wirefilter_external_scanner_create(void) { return NULL; }
void tree_sitter_wirefilter_external_scanner_destroy(void *payload) {
  (void)payload;
}
unsigned tree_sitter_wirefilter_external_scanner_serialize(void *payload,
                                                           char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_wirefilter_external_scanner_deserialize(void *payload,
                                                         const char *buffer,
                                                         unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_wirefilter_external_scanner_scan(void *payload,
                                                  TSLexer *lexer,
                                                  const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[RAW_STRING] && !valid_symbols[REGEX_STRING] &&
      !valid_symbols[QUOTED_STRING] && !valid_symbols[INTEGER] &&
      !valid_symbols[IMMEDIATE_INTEGER]) return false;
  // Both quote modes are only requested together during error recovery.
  // Do not let regex's permissive escapes mask an invalid byte literal.
  if (valid_symbols[REGEX_STRING] && valid_symbols[QUOTED_STRING]) return false;

  // Tree-sitter does not apply `extras` before invoking an external scanner.
  // Match Wirefilter's skip_space() here so raw strings work after an
  // operator, including when the separator contains a newline.
  while (lexer->lookahead == ' ' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\n') {
    if (valid_symbols[IMMEDIATE_INTEGER] && !valid_symbols[INTEGER]) return false;
    lexer->advance(lexer, true);
  }

  if ((valid_symbols[INTEGER] || valid_symbols[IMMEDIATE_INTEGER]) &&
      (lexer->lookahead == '-' || (lexer->lookahead >= '0' && lexer->lookahead <= '9'))) {
    const bool negative = lexer->lookahead == '-';
    if (negative) lexer->advance(lexer, false);
    unsigned radix = 10;
    bool saw_digit = false;
    bool valid = true;
    if (!negative && lexer->lookahead == '0') {
      lexer->advance(lexer, false);
      radix = 8;
      saw_digit = true;
      if (lexer->lookahead == 'x') {
        lexer->advance(lexer, false);
        radix = 16;
        saw_digit = false;
      }
    }
    // Upstream lex_digits consumes ALL hex digits before validating the base.
    // Never split 09 or 12ab into multiple valid set elements.
    for (;;) {
      const int32_t c = lexer->lookahead;
      unsigned digit;
      if (c >= '0' && c <= '9') digit = (unsigned)(c - '0');
      else if (c >= 'a' && c <= 'f') digit = (unsigned)(c - 'a' + 10);
      else if (c >= 'A' && c <= 'F') digit = (unsigned)(c - 'A' + 10);
      else break;
      saw_digit = true;
      valid = valid && digit < radix;
      lexer->advance(lexer, false);
    }
    if (!saw_digit || !valid) return false;
    lexer->mark_end(lexer);
    // Leave byte strings and IP addresses to the internal lexer. For an
    // integer range, keep the marked end before its two-dot delimiter.
    if (lexer->lookahead == ':') return false;
    if (lexer->lookahead == '.') {
      lexer->advance(lexer, false);
      if (lexer->lookahead != '.') return false;
    }
    lexer->result_symbol = valid_symbols[IMMEDIATE_INTEGER] ? IMMEDIATE_INTEGER : INTEGER;
    return true;
  }

  if (valid_symbols[QUOTED_STRING] && lexer->lookahead == '"') {
    lexer->advance(lexer, false);
    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '"') {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        lexer->result_symbol = QUOTED_STRING;
        return true;
      }
      if (lexer->lookahead == '\\') {
        lexer->advance(lexer, false);
        if (lexer->eof(lexer)) return false;
        if (lexer->lookahead == '"' || lexer->lookahead == '\\') {
          lexer->advance(lexer, false);
        } else if (lexer->lookahead == 'x') {
          lexer->advance(lexer, false);
          for (unsigned i = 0; i < 2; i++) {
            const int32_t c = lexer->lookahead;
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
                  (c >= 'A' && c <= 'F'))) return false;
            lexer->advance(lexer, false);
          }
        } else if (lexer->lookahead >= '0' && lexer->lookahead <= '3') {
          // Three octal digits encode a byte, so the first must be 0..3.
          lexer->advance(lexer, false);
          for (unsigned i = 0; i < 2; i++) {
            if (lexer->lookahead < '0' || lexer->lookahead > '7') return false;
            lexer->advance(lexer, false);
          }
        } else {
          return false;
        }
      } else {
        lexer->advance(lexer, false);
      }
    }
    return false;
  }

  if (valid_symbols[REGEX_STRING] && lexer->lookahead == '"') {
    bool in_character_class = false;
    lexer->advance(lexer, false); // opening quote

    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '\\') {
        lexer->advance(lexer, false);
        if (!lexer->eof(lexer)) lexer->advance(lexer, false);
        continue;
      }
      if (lexer->lookahead == '"') {
        if (in_character_class) {
          lexer->advance(lexer, false);
          continue;
        }
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        lexer->result_symbol = REGEX_STRING;
        return true;
      }
      if (lexer->lookahead == '[' && !in_character_class) {
        in_character_class = true;
      } else if (lexer->lookahead == ']' && in_character_class) {
        in_character_class = false;
      }
      lexer->advance(lexer, false);
    }
    return false;
  }

  if (!valid_symbols[RAW_STRING] || lexer->lookahead != 'r') return false;

  lexer->advance(lexer, false); // r
  unsigned hashes = 0;
  while (lexer->lookahead == '#' && hashes < 255) {
    lexer->advance(lexer, false);
    hashes++;
  }
  if (lexer->lookahead != '"') return false;
  lexer->advance(lexer, false); // opening quote

  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '"') {
      lexer->advance(lexer, false);
      unsigned closing_hashes = 0;
      while (lexer->lookahead == '#' && closing_hashes < hashes) {
        lexer->advance(lexer, false);
        closing_hashes++;
      }
      if (closing_hashes == hashes) {
        lexer->mark_end(lexer);
        lexer->result_symbol = RAW_STRING;
        return true;
      }
      // This quote was not followed by enough hashes: it belongs to the body.
      continue;
    }
    lexer->advance(lexer, false);
  }
  return false;
}
