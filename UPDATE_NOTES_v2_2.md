# LODU Online v2.2 — three-button menu and synchronized dice beta

- New home menu: PLAY OFFLINE, INVITE FRIENDS, JOIN A FRIEND. Existing background art and original offline gameplay preserved.
- Lobby dynamically disables other players’ selected factions (server already rejects duplicates).
- Server retains `lastRoll` with monotonic `id`, face, player and noMove. Every roll now has a displayable record even when the turn immediately advances.
- Client processes WebSocket state messages sequentially, animating new roll ids on both devices and retaining the face after a no-move roll.
- This is a separate beta. Deploy to a **new** Render service and repository or a separate preview branch, not over the known-working v2 service until tested.
- Test: 2 phones, rolls 2–5 before first deployment, simultaneous updates, all legal moves, faction switching, offline play, reconnect, Kamikaze, elimination cinematics.
- Limitations: server still keeps rooms in RAM; Render restart loses games. The original baked-in PLAY art is covered by the menu panel rather than replaced in the source image.
