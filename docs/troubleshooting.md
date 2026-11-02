# Troubleshooting

## Docker services do not start

Check status and logs:

```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
```

If port 5432 or 6379 is already in use, stop the conflicting service or change the host port mapping and update the corresponding connection URL in `.env`.

## API cannot connect to PostgreSQL

1. Confirm PostgreSQL is healthy: `docker compose ps`.
2. Confirm `DATABASE_URL` in `.env` matches the local container credentials and port.
3. Run `pnpm db:generate`.
4. Run `pnpm db:migrate`.
5. Restart the API.

For host-run Node processes, use `localhost` in DATABASE_URL. If the API is later run inside the Compose network, the hostname should be the Compose service name (`postgres`), not localhost.

## Prisma client or schema errors

After changing `apps/api/prisma/schema.prisma`, run:

```bash
pnpm db:generate
pnpm db:migrate
```

Review and commit the generated migration directory. Do not edit production database schema manually as a substitute for migrations.

## API returns 401 Unauthorized

- Ensure the header is exactly `Authorization: Bearer <key>`.
- Use the complete key printed by the seed command, not only its prefix.
- Ensure test keys use the test environment.
- Confirm the key has not expired or been revoked.
- If you lost the full key, it cannot be recovered from the database; create a new local merchant using a new slug.

## API returns 403 Forbidden

The API key authenticated but does not include the required scope. Customer routes require `customers:read` or `customers:write`. PaymentIntent routes require `payment_intents:read` or `payment_intents:write`.

## API returns 409 Conflict

- Customer create: the normalized email already exists for this merchant.
- PaymentIntent create: the idempotency key was previously used with a different request. Use the original request to replay, or use a new key for a genuinely new operation.

## API returns 422 for PaymentIntent create

The `Idempotency-Key` header is required and must contain 8–255 safe characters. The amount must be a positive integer and currency must be exactly three uppercase letters.

## Browser CORS error

Check `WEB_ORIGIN` in `.env`. It must contain the exact browser origin, including scheme and port, for example `http://localhost:3000`. Multiple allowed origins can be comma-separated. Restart the API after changing the environment.

## Port 3000 or 4000 is occupied

Stop the process using the port or update the relevant app configuration. The web dev script currently uses port 3000; the API uses `API_PORT` (default 4000).

## Build or CI fails

Run checks separately to isolate the failure:

```bash
pnpm db:generate
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Read the first compiler/test error rather than treating downstream skipped steps as independent failures. CI status is available at https://github.com/fuzavhora/payflow/actions.

## Reset all local database state

**Destructive:** this removes local PostgreSQL and Redis volumes:

```bash
docker compose down -v
docker compose up -d
pnpm db:migrate
```

Do not run this against any environment containing data you need.
