# Domo Embed JS API — RPC Method Reference

## Table of Contents
1. [Message Format](#message-format)
2. [Handshake](#handshake)
3. [Host → Domo Methods](#host--domo-methods)
4. [Domo → Host Events](#domo--host-events)
5. [PFilter URL Parameters](#pfilter-url-parameters)
6. [Other URL Parameters](#other-url-parameters)

---

## Message Format

All communication uses JSON-RPC 2.0 over MessagePort:

**Request (Host → Domo):**
```json
{
  "id": "unique-request-id",
  "jsonrpc": "2.0",
  "method": "/v1/method/name",
  "params": { }
}
```

**Event (Domo → Host):**
```json
{
  "method": "/v1/event/name",
  "params": { }
}
```

**Response (after a request):**
```json
{
  "id": "matching-request-id",
  "jsonrpc": "2.0",
  "result": { }
}
```

**Error:**
```json
{
  "id": "matching-request-id",
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid request"
  }
}
```

---

## Handshake

The Domo iframe initiates the connection by posting a `message` event to `window.parent` with:
- `data.referenceId` — a unique identifier for this iframe instance
- `ports[0]` — a `MessagePort` for bidirectional communication

**Prerequisite:** Your host domain must be listed in **Admin > Network Security > Embed Authorized Domains** in Domo.

**Handshake listener:**
```typescript
window.addEventListener('message', (e: MessageEvent) => {
  if (!e.ports || !e.ports[0]) return;
  const referenceId = e.data?.referenceId;
  if (!referenceId) return;

  const port = e.ports[0];
  port.start();
  // Store port keyed by referenceId
});
```

The handshake only occurs for authenticated embeds (token-based POST flow). Public embed URLs do not initiate it.

---

## Host → Domo Methods

### `/v1/filters/apply`

Apply runtime filters to the embedded content.

**Request:**
```json
{
  "id": "filter-1711234567890",
  "jsonrpc": "2.0",
  "method": "/v1/filters/apply",
  "params": {
    "filters": [
      {
        "column": "Region",
        "operand": "IN",
        "values": ["West"]
      }
    ]
  }
}
```

**Filter object properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `column` | string | Yes | Exact column name in the dataset |
| `operand` | string | Yes | Filter operator — see supported operands below |
| `values` | array | Yes | Values to filter by |
| `dataType` | string | No | `STRING`, `NUMBER`, or `DATE` — helps Domo interpret values |
| `dataSourceId` | string | No | Target a specific dataset in multi-dataset embeds |

**Supported operands:**
- `IN` — value is in the list
- `NOT_IN` — value is not in the list
- `EQUALS` — exact match
- `NOT_EQUALS` — not equal
- `GREATER_THAN` — greater than
- `GREATER_THAN_EQUALS_TO` — greater than or equal
- `LESS_THAN` — less than
- `LESS_THAN_EQUALS_TO` — less than or equal
- `BETWEEN` — value is between two values (pass exactly 2 items in `values`)
- `CONTAINS` — partial string match

**Notes:**
- Pass an empty `filters` array to clear all client-side filters
- Multiple filters are ANDed together
- Client-side filters narrow within server-side (programmatic) filter boundaries
- SQL filter syntax is not supported — use standard filter objects only
- The property is `operand`, not `operator` (differs from server-side filters)

### `/v1/appData/apply`

Send arbitrary context data to an embedded App Studio app.

**Request:**
```json
{
  "id": "appData-1711234567890",
  "jsonrpc": "2.0",
  "method": "/v1/appData/apply",
  "params": {
    "appData": "your custom data here"
  }
}
```

The `appData` value can be a string, number, object, or array — whatever the App Studio app expects. The embedded app receives it via its internal `domo.onAppData()` listener.

---

## Domo → Host Events

### `/v1/onDrill`

Fired when a user clicks a drillable data point in the embed.

**Event:**
```json
{
  "method": "/v1/onDrill",
  "params": {
    "filters": [
      {
        "column": "Region",
        "operand": "EQUALS",
        "values": ["West"]
      }
    ]
  }
}
```

Use cases:
- Navigate to a detail page based on the drilled value
- Apply the drill filters to another embed on the same page
- Log analytics about user interactions

### `/v1/onFiltersChange`

Fired when filters change inside the embedded content — from user interaction with the filter bar, card-to-card interactions, or programmatic changes within Domo.

**Event:**
```json
{
  "method": "/v1/onFiltersChange",
  "params": {
    "filters": [
      {
        "column": "Region",
        "operand": "IN",
        "values": ["West", "East"]
      }
    ]
  }
}
```

Use cases:
- Keep host UI in sync with filters applied inside the embed
- Sync filter state across multiple embeds on the same page
- Track which filters users interact with

### `/v1/onAppReady`

Fired by an App Studio app when it has finished loading and is ready to receive input. This is the signal to send initial filters and appData.

**Event:**
```json
{
  "method": "/v1/onAppReady",
  "params": {}
}
```

Use cases:
- Send initial filters after the app loads (especially with `overrideFilters=true`)
- Send appData context to the app
- Show a loading indicator until this event fires

### `/v1/onAppData`

Fired when an embedded App Studio app sends context data back to the host page.

**Event:**
```json
{
  "method": "/v1/onAppData",
  "params": {
    "appData": { "selectedItem": "ABC-123" }
  }
}
```

Use cases:
- Receive user selections or actions from the embedded app
- Trigger host-side navigation or state changes based on app interactions
- Bidirectional communication between host and App Studio

### `/v1/onFrameSizeChange`

Fired when the embedded content changes its dimensions (e.g., card expansion, filter bar toggle).

**Event:**
```json
{
  "method": "/v1/onFrameSizeChange",
  "params": {
    "width": 1200,
    "height": 800
  }
}
```

Use cases:
- Auto-resize the iframe container to eliminate scrollbars
- Adjust layout of surrounding content

---

## PFilter URL Parameters

A no-JavaScript alternative for applying filters via URL query strings. Triggers a full iframe refresh.

**Format:**
```
?pfilters=[{"column":"Name","operand":"OPERATOR","values":["val1","val2"]}]
```

**Example:**
```
https://example.domo.com/embed/pages/private/ABCDE?pfilters=[{"column":"Region","operand":"IN","values":["West","East"]},{"column":"Year","operand":"EQUALS","values":["2025"],"dataType":"NUMBER"}]
```

**Filter properties:** Same as JS API filters — `column`, `operand`, `values`, plus optional `dataSourceId` and `dataType`.

**Security warning:** PFilters are visible in the URL and can be modified by end users. They are NOT a secure alternative to server-side programmatic filters.

---

## Other URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `overrideFilters=true` | App Studio ignores saved defaults, waits for host-provided filters | `?overrideFilters=true` |
| `transparentBackground=true` | Makes dashboard background transparent | `?transparentBackground=true` |
| `appData=value` | Pass initial context to App Studio apps (spaces as `+`) | `?appData=Salt+Lake+City` |
| `viewId=abc123` | Specify which App Studio page view to display | `?viewId=abc123` |
