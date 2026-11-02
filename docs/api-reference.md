# API Reference

**API base URL:** `http://localhost:4000/api/v1`  
**Authentication:** `Authorization: Bearer <test_api_key>`

All endpoints below describe the current development branch, not a stable public API contract. All protected endpoints are merchant-scoped using the merchant resolved from the verified API key. A caller cannot choose a merchant ID.

## Common behavior

- JSON request and response bodies.
- Unknown request fields are rejected.
- Validation errors are returned by NestJS.
- List endpoints accept `page` (default 1) and `limit` (default 20).
- Amounts are integer minor units and are serialized as strings.
- API keys are scoped. Missing scope results in HTTP 403.
- Do not place secret API keys in frontend/browser code.

## Health

### GET /health

No API key required.

```bash
curl http://localhost:4000/api/v1/health
```

Returns application/database health information.

## Customers

Required scopes: `customers:read`, `customers:write`.

### POST /customers

Create a customer.

Request:

```json
{
  "email": "customer@example.com",
  "name": "Demo Customer",
  "metadata": { "source": "local-demo" }
}
```

Example:

```bash
curl -X POST http://localhost:4000/api/v1/customers \
  -H "Authorization: Bearer $PAYFLOW_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","name":"Demo Customer"}'
```

Email is trimmed and normalized to lowercase. Email is unique per merchant. Duplicate email for the same merchant returns HTTP 409. Optional fields: `name` (max 160 characters) and object `metadata`.

### GET /customers

List customers belonging to the authenticated merchant.

Query parameters: `page`, `limit`.

```bash
curl "http://localhost:4000/api/v1/customers?page=1&limit=20" \
  -H "Authorization: Bearer $PAYFLOW_TEST_KEY"
```

Response shape:

```json
{
  "data": [
    {
      "id": "customer_id",
      "object": "customer",
      "email": "customer@example.com",
      "name": "Demo Customer",
      "metadata": null,
      "createdAt": "2026-11-02T00:00:00.000Z",
      "updatedAt": "2026-11-02T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /customers/{id}

Retrieve one customer owned by the authenticated merchant. A resource belonging to another merchant is indistinguishable from a missing resource and returns HTTP 404.

## PaymentIntents

Required scopes: `payment_intents:read`, `payment_intents:write`.

> Important: The current PaymentIntent endpoints create and retrieve local database records only. No provider adapter or payment execution is connected. A successful API response does not mean payment succeeded.

### POST /payment-intents

Required header: `Idempotency-Key` (8–255 characters; letters, digits, dot, underscore, colon, and hyphen).

Request:

```json
{
  "amount": 1000,
  "currency": "USD",
  "customerId": "optional_customer_id",
  "description": "Local test order",
  "metadata": { "orderId": "order-123" }
}
```

Validation:
- `amount`: integer from 1 through JavaScript's maximum safe integer.
- `currency`: exactly three uppercase letters. This validates shape only, not whether the currency is supported by a provider.
- `customerId`: optional string, must belong to the authenticated merchant.
- `description`: optional string, max 500 characters.
- `metadata`: optional JSON object.

Example:

```bash
curl -X POST http://localhost:4000/api/v1/payment-intents \
  -H "Authorization: Bearer $PAYFLOW_TEST_KEY" \
  -H "Idempotency-Key: local-order-0001" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"currency":"USD","description":"Local test order"}'
```

The initial status is `requires_payment_method`. Amount is returned as a decimal string to avoid JSON/JavaScript precision loss.

#### Idempotency behavior

- The idempotency key is unique within a merchant.
- Repeating the same key with the same canonical request returns the original stored response and sets `idempotentReplay: true`.
- Reusing the same key with a different request returns HTTP 409.
- Use a new key for a genuinely new operation.
- Do not reuse keys across unrelated orders.

### GET /payment-intents

List PaymentIntents belonging to the authenticated merchant.

Query parameters: `page`, `limit`.

### GET /payment-intents/{id}

Retrieve one PaymentIntent owned by the authenticated merchant. A resource belonging to another merchant returns HTTP 404.

## Error handling

Typical HTTP status codes:

| Status | Meaning | Suggested client action |
| --- | --- | --- |
| 400 | Invalid request or validation failure | Correct the request; do not retry unchanged |
| 401 | Missing, malformed, expired, revoked, or invalid API key | Check key and environment |
| 403 | Key is valid but lacks required scope | Issue/use a key with the required scope |
| 404 | Resource does not exist for this merchant | Verify resource ID and tenant |
| 409 | Duplicate customer email or idempotency key conflict | Resolve duplicate or use a new idempotency key for a new operation |
| 422 | Invalid/missing idempotency key | Send a valid key |
| 5xx | Server-side failure | Retry cautiously with the same idempotency key for the same operation |

Do not interpret a successful PaymentIntent create response as a payment authorization or settlement. Payment execution, provider status mapping, capture, refunds, and webhook endpoints are not implemented.
