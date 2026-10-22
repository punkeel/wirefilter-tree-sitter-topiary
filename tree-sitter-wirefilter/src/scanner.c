#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// A scanner is necessary for raw strings with variable-length delimiters and
// regex strings whose closing quote depends on character-class state.
enum TokenType { RAW_STRING, REGEX_STRING };

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
  if (!valid_symbols[RAW_STRING] && !valid_symbols[REGEX_STRING]) return false;

  // Tree-sitter does not apply `extras` before invoking an external scanner.
  // Match Wirefilter's skip_space() here so raw strings work after an
  // operator, including when the separator contains a newline.
  while (lexer->lookahead == ' ' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\n') {
    lexer->advance(lexer, true);
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
