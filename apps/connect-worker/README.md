# vozen connect worker

Cloudflare Worker relay for vozen's remote access feature (vozen's own
equivalent of bb connect — see `spec/plan.md`). Lets a phone or another
computer reach a vozen server running behind NAT/no public IP, via
`https://<handle>.<your-domain>`.

## One-time setup

1. Your domain's nameservers must be on Cloudflare (Cloudflare must be the
   DNS provider, not just a CDN in front of it) — required for the wildcard
   route below to work.
2. `cd apps/connect-worker && bun install`
3. `bunx wrangler login`
4. Create the D1 database:
   ```
   bunx wrangler d1 create vozen-connect
   ```
   Copy the `database_id` it prints into `wrangler.toml`'s
   `[[d1_databases]]` block (replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`).
5. Apply the schema: `bun run db:migrate:remote`
6. Set your domain in `wrangler.toml`'s `[vars] APEX_DOMAIN` and
   `[[routes]] zone_name` (defaults to `vozen.io`).
7. Add a wildcard DNS record in the Cloudflare dashboard for your zone:
   `*` (or `*.<apex>`), type `A`, content `192.0.2.1` (any IP — the Worker
   route intercepts the request before this ever resolves), **Proxied**
   (orange cloud) must be on.
8. Pick a setup token (any random string) and set it as a secret:
   ```
   bunx wrangler secret put SETUP_TOKEN
   ```
9. Deploy: `bun run deploy`

## Registering a machine

From the vozen machine you want to reach remotely:

```
uv run vozen connect register <handle> --worker-url https://<your-domain> --setup-token <token>
```

This claims `<handle>` and saves the returned credential to
`~/.vozen/connect.json`. Then start the tunnel:

```
uv run vozen connect start
```

Leave that running (or run it alongside `vozen serve`) and
`https://<handle>.<your-domain>` proxies to your local vozen server.

## Known gaps vs. bb connect

See `spec/plan.md`. No account system, no dashboard, no multi-device
pairing UI, no per-share port registry (vozen only ever exposes its own
server) — this is the minimum viable version of the same architecture, not
a feature-for-feature port.
