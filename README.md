# Link Robins Shoutbox

A real-time shoutbox widget for [Flarum 2.0](https://flarum.org), built as a widget for [`fof/forum-widgets-core`](https://github.com/FriendsOfFlarum/forum-widgets-core).

## Features

- **Live shoutbox** in any widget placement (sidebar, top, bottom, full-width sections)
- **Polling-based updates** every 15 seconds
- **Adaptive button** — icon-only when placed in the sidebar, icon + "Send" when placed in full-width sections
- **Configurable height** — admins can set the messages area height in the extension settings
- **Permission-aware** — usernames link to profiles only if the viewer has `viewForum` permission
- **Guest-friendly** — guests see the most recent 10 messages and a "Log in to shout!" prompt; members see the most recent 30 and can post
- **Admin-only deletion** — only administrators can delete shouts
- **280-character limit** per shout (Twitter-style)
- **Avatar fallback** — users without an avatar get a coloured letter avatar with a deterministic per-user colour

## Requirements

- Flarum **2.0** or later
- [`fof/forum-widgets-core`](https://github.com/FriendsOfFlarum/forum-widgets-core) installed and enabled

## Installation

   ```
   composer require linkrobins/shoutbox
   php flarum migrate
   php flarum cache:clear
   ```

4. In Flarum admin → **Extensions**, find **Link Robins Shoutbox** under the **Forum Widgets** category and enable it.

5. Open `fof/forum-widgets-core` settings and place the Shoutbox widget where you want it (sidebar, top, bottom, etc.).


## Settings

- **Messages height (px)** — height of the scrollable messages area. Default is 320 pixels. Range is 100–1000.


## Permissions

The shoutbox is intentionally simple about permissions.


## Styling

The widget uses Flarum 2's CSS custom properties (`var(--primary-color)`, `var(--text-color)`, etc.) so it picks up your theme automatically. The send button shape changes based on placement, detected via parent class:

- `.sideNav`, `.IndexPage-nav`, `.FofWidgets-sideNavAlt` ancestors → icon-only square button
- Everything else (top, bottom, full-width sections) → icon + "Send" label

If you want to override styles, target `.ShoutboxWidget` and its modifier classes from your custom Less in **Admin → Appearance**.

## Troubleshooting

**Widget doesn't appear in `fof/forum-widgets-core` config page:**
Run `php flarum cache:clear` and reload the admin page. If it still doesn't appear, verify the extension is enabled in **Extensions**.

**500 error on the homepage after enabling:**
Almost always a missing migration. Run `php flarum migrate`. If it persists, check `storage/logs/flarum-YYYY-MM-DD.log` for the actual exception.


**Shouts post but don't appear until refresh:**
Polling is set to 15 seconds. If you're seeing longer delays, check the browser's network tab for failing `GET /api/shoutbox` requests.

## License

MIT
