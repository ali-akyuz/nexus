# NEXUS Jobs Exploration

## Advanced Filtering & Pagination

The `/jobs` API has been completely refactored to support advanced exploration.

### Endpoint
`GET /jobs`

### Query Parameters
- `page` (number, default: 1)
- `limit` (number, default: 25)
- `status` (JobStatus Enum)
- `type` (String)
- `priority` (JobPriority Enum)
- `search` (String) — Supports full UUID matching (`id`) or partial string matching (`type`).
- `sortBy` (String, default: 'createdAt')
- `sortOrder` ('asc' | 'desc', default: 'desc')

### Response Shape
```json
{
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

## UI Implementation
- The `/jobs` Datatable pushes filter states (`status`, `type`, `search`) to TanStack Query keys, ensuring seamless, URL-friendly caching and pagination without downloading the entire dataset to the browser.
