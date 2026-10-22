#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// A scanner is necessary because r###"..."### has a variable-length
// delimiter, which cannot be matched by a Tree-sitter regular expression.
enum TokenType { RAW_STRING };

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
  if (!valid_symbols[RAW_STRING] || lexer->lookahead != 'r') return false;

  lexer->advance(lexer, false); // r
  unsigned hashes = 0;
  while (lexer->lookahead == '#' && hashes < 255) {
    lexer->advance(lexer, false);
    hashes++;
  }
  if (lexer->lookahead != '"') return false;
  lexer->advance(lexer, false); // opening quote

  while (lexer->lookahead != 0) {
    if (lexer->lookahead == '"') {
      lexer->advance(lexer, false);
      unsigned closing_hashes = 0;
      while (lexer->lookahead == '#') {
        lexer->advance(lexer, false);
        closing_hashes++;
      }
      if (closing_hashes >= hashes) {
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
