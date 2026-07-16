# Custom NIPs for cwtext

## Kind 30023: Long-form Content (NIP-23)

This project uses the standard **NIP-23** `kind:30023` for long-form content notes.

The `title` tag stores the **Para.** label (free text). The `order` tag stores a numeric sort value (to 1dp) for sequencing notes into an ordered list.

### Format

```json
{
  "kind": 30023,
  "content": "<main text body in Markdown>",
  "tags": [
    ["d", "<unique-identifier>"],
    ["title", "<para label e.g. Introduction or 456n>"],
    ["order", "<numeric sort value to 1dp e.g. 1.0>"],
    ["t", "<category-tag>"],
    ["t", "<another-category>"],
    ["published_at", "<unix-timestamp>"],
    ["alt", "Long-form Content"]
  ]
}
```

### Tags

Per [NIP-23](https://github.com/nostr-protocol/nips/blob/master/23.md):

| Tag            | Required | Description                                           |
|----------------|----------|-------------------------------------------------------|
| `d`            | yes      | Unique identifier for the addressable event           |
| `title`        | yes      | The paragraph label (Para.) — free text               |
| `order`        | no       | Numeric order for sequencing (to 1dp, e.g. 1.0)       |
| `t`            | no       | Category tags for filtering/searching (repeatable)    |
| `published_at` | no       | Original publication timestamp (Unix seconds)         |
| `alt`          | yes      | Human-readable description per NIP-31                 |

### Content

The `content` field contains the main text body in Markdown format, per NIP-23 specification.

### Comments

Comments on kind 30023 notes use NIP-22 (kind 1111) comments, as specified by NIP-23.
