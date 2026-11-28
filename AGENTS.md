<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Suite demo state lives in one store (src/lib/suite/store.tsx) holding a data slice per hotel, saved to the browser; every cross-module effect is an action there so all screens stay consistent.
- Room display state is derived from separate booking, stay, housekeeping and maintenance fields — never stored directly — to avoid mixing concepts.
- World saves mirror new hotels/floors/rooms and archive removals; existing room configuration is authoritative in hotel_rooms and edited through suite_edit_room, which also patches the world under lock. Why: prevent stale world saves from reverting authorized edits.
- Reuse RoomSheet's editor for all room configuration entry points and authorize writes in the database using hotel membership; UI/demo role guards are not security. Why: one editor and persisted configuration with company isolation.
- Per-hotel job roles live in hotel_members and are enforced by RLS via has_hotel_role(); never trust client-side role checks.
- Room furniture layout lives in src/lib/suite/layout.ts (pure rules, bounds clamping) and is saved per room via suite_edit_room; drawings never fill in category defaults as real data. Why: honest per-room configuration.
- Staff permissions: role ceilings live in suite_role_modules() (mirrored in src/lib/suite/staff-access.ts); per-member modules are clamped by trigger and inactive members fail has_hotel_role. Why: deactivate without deleting history, permissions enforced in the database.
- Revenue figures (YoY, budget, ADR) are computed only by src/lib/suite/revenue.ts from stored reservations; budgets live in hotel_budgets (RLS owner/director/revenue). Why: one counting rule, no fabricated history.
- Staff join only through single-use invite links (token, expiry ≤30 days, revocation) accepted by suite_accept_invite with matching email; email auto-claim is retired. Why: no silent access, revocable.
- Cloud hydration replaces demo state per verified identity; caches are UID-scoped and queued loads/saves are identity-guarded. Why: prevent account switches from mixing company data or overwriting another session.
- Owner membership is allowed only for the immutable hotels.org_owner; invitation roles remain staff-only. Why: permit legitimate world synchronization without staff privilege escalation.
- Signup returns an explicit confirmation/session/error outcome; login continues once verified identity hydration finishes, and pending invitations are consumed only after acceptance. Why: never confuse a successful signup with an authenticated, loaded account.
- Shared operations use hotel-scoped entity rows and a SECURITY INVOKER atomic compare-before-write command, with polling paused during pending writes; room housekeeping/OOS has separate storage. Why: retain central store actions while enforcing RLS, cross-entity consistency and conflicts without changing configuration or demo.
- Guest form edits call the central updateGuest action and existing operational queue; repeated task transitions read the latest store reference. Why: keep cross-screen edits consistent and reject rapid repeated commands without replacing atomic persistence.
- External API orchestration lives in api/engine.server.ts with injected backend authorization, durable atomic run claims and credential resolution; never wire it to an in-memory production repository. Why: prevent credential exposure, cross-hotel access and duplicate remote writes.
- API PMS projections reuse reservations.ts, temporal.ts and revenue.ts; inbound commands remain unconnected until external identity mappings and the existing atomic PMS persistence can be used. Why: avoid a parallel reservation engine or untracked imports.
- API schema drafts require authorization before deployment; external credentials use managed server references, while own Suite credentials store only hashes and ciphertext. Why: keep secrets server-controlled and avoid silent hotel changes.
- Quendoo HTTP and webhook verification live in api/quendoo.server.ts, with contracts sourced from its official OpenAPI; bindings are backend-owned and ACK requires a separate durable PMS revision read-back. Why: avoid invented endpoints, cross-hotel routing and acknowledgements of unsaved bookings.
- Dashboard room income reuses revenue.ts night-counting rules; static Control analytics and recommendations render only in demo. Why: keep real-hotel metrics consistent without presenting fabricated forecast or billing data.
- Connection RPCs recheck existing database module and owner/director permissions, derive organization from the authorized hotel and use hotel-keyed managed server configuration for staging-only probes; no browser-selected binding or credential reference. Why: make setup checks operational without enabling unapproved PMS writes or misrepresenting a read-only probe as a durable connection.
- Inbound bookings enter only through api/inbound.ts (pure plan using reservations.ts rules) and inbound.server.ts (signed webhook, deterministic Q-<booking_code> rows in existing hotel_reservations/hotel_guests, revision-monotonic dedup, read-back, audit_log entity quendoo_sync without PII). Test-signed deliveries are accepted only for TEST_BINDINGS hotels; staging treats webhooks as a doorbell and reads the feed, ACK after read-back. Why: one PMS, no duplicates, no migration, no fake provider in real hotels.
- Own Suite API integrations use hotel-scoped credentials, exact room mappings, durable event claims and suite_apply_api_reservation for atomic guest+reservation writes; public routes authenticate signatures before any payload processing. Why: bidirectional connectivity without cross-hotel access or a parallel PMS.
