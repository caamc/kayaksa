# Instructions for Claude

## Commit authorship

Every commit in this repository is authored by the owner and records that the code was built using Claude:

- Author: `Anuj Choudhary <anuj@kayaksa.com>`. Set it per clone with
  `git config user.name "Anuj Choudhary"` and `git config user.email "anuj@kayaksa.com"`.
- End every commit message with these lines, in this order:

  ```
  Built by Anuj Choudhary using Claude.

  Co-authored-by: Anuj M Choudhary <anuj.c@outlook.com>
  ```

  followed by any Claude attribution lines the session requires (for example `Co-Authored-By: Claude …`).
- Don't rewrite or re-author existing commits.
