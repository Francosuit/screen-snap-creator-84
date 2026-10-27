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
- Hotels, floors and rooms are mirrored into relational tables by a database trigger on company_worlds (never deleting: removed items are archived); the app still reads the saved world, so switch reads over gradually. Why: migrate without data loss or downtime.
- Per-hotel job roles live in hotel_members and are enforced by RLS via has_hotel_role(); never trust client-side role checks.
