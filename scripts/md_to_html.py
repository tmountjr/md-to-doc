#!/usr/bin/env python3
import sys
import markdown

md_text = sys.stdin.read()
html_body = markdown.markdown(md_text, extensions=['extra', 'sane_lists', 'smarty'])
html_doc = (
    "<!DOCTYPE html>\n"
    "<html>\n"
    "<head><meta charset=\"utf-8\"></head>\n"
    "<body>\n"
    f"{html_body}\n"
    "</body>\n"
    "</html>"
)
sys.stdout.write(html_doc)
