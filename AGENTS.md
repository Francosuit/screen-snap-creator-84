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
