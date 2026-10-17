# Test proposals

Candidates for periodic user review. Entries are proposals, not approval to write tests. The user chooses which items to implement.

Append one checklist item per distinct failure using this format. Describe behavior, not a proposed helper test:

```markdown
- [ ] <Behavior or risk>
  - Failure and consequence: <plausible bug and impact on customers or operations>.
  - Observable result: <existing module entrypoint and exact outcome to assert>.
  - Coverage gap: <why existing tests and static checks miss this failure>.
```

For a proposed rewrite or removal, name the existing test, explain its defect or implementation coupling, and identify meaningful coverage to preserve.

Check for an equivalent proposal before adding an item. Keep unapproved entries pending. Check an item only after the user approves it and the approved change is completed.

## Pending proposals

