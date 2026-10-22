{
  languages.wirefilter = {
    extensions = ["wirefilter", "wf"],
    indent = "    ",
    # This path is resolved relative to this languages.ncl, not the CWD.
    # Run scripts/build.sh before formatting to create the shared library.
    grammar.source.path = "../tree-sitter-wirefilter/wirefilter.so",
    grammar.symbol = "tree_sitter_wirefilter",
    queries.formatting.source.path = "./queries/formatting.scm",
  },
}
