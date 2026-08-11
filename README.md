# Link Robins Shoutbox

A shoutbox for [Flarum 2.0](https://flarum.org): a small live chat area your members can post short messages into. It can appear as a widget through [`fof/forum-widgets-core`](https://github.com/FriendsOfFlarum/forum-widgets-core), as its own `/shoutbox` page, or both.

## What it does

- **Shows a live message list** that refreshes on its own while the page is open, so a conversation appears without anyone reloading.
- **Runs as a widget, a page, or both.** As a widget it fits any `fof/forum-widgets-core` placement (sidebar, top, bottom, full-width). As a page it gets its own `/shoutbox` route and a link in the sidebar navigation.
- **Reads in either direction.** Newest messages at the bottom (chat style) or at the top, with the typing box following the newest message so it is always next to the action.
- **Limits shouts to 280 characters**, enforced in the browser and again on the server.
- **Holds people to a cooldown** between shouts, so one person cannot flood the box.
- **Prunes itself.** Only the newest N shouts are kept (500 by default), so the table cannot grow without limit on a busy forum.
- **Fits your theme automatically** through Flarum's CSS custom properties, including a coloured letter avatar for members who have not set one.

## What it does NOT do

- **It is not a full chat system.** There are no private messages, rooms, threads, reactions or file uploads. It is one shared box of short messages.
- **It does not use WebSockets.** Updates arrive by asking the server on a timer (see below), so a message can take up to the refresh interval to appear.
- **It does not edit shouts.** A shout can be deleted, not changed.
- **It has no per-message privacy.** Visibility is all or nothing, tied to who can view the forum.

## Settings

Found in **Admin → Extensions → Link Robins Shoutbox**.

| Setting | Default | What it does |
|---|---|---|
| Display mode | Page and widget | Whether the shoutbox appears as a page, as a widget, or both. Also controls the sidebar link and the route. |
| Message order | Oldest first | Whether the newest message sits at the bottom (chat style) or the top. |
| Typing box position | Next to the newest message | Follows the message order by default, or pin it to the top or bottom. |
| Messages height (px) | 320 | Height of the scrollable message area. Accepts 100 to 1000. |
| Refresh interval (seconds) | 30 | How often an open shoutbox checks for new messages. Accepts 10 to 300. |
| Cooldown (seconds) | 3 | Minimum wait between one person's shouts. Set it to 0 to turn flood control off. |
| Maximum stored shouts | 500 | Older shouts beyond this count are pruned. |

Ranges, for the numeric ones: height 100 to 1000, refresh interval 10 to 300, cooldown 0 to 3600, maximum stored shouts 1 to 100000.

## Permissions

Set in **Admin → Permissions**.

| Permission | Who needs it |
|---|---|
| Post shouts | Anyone you want to be able to write. Without it, the box is read only for them. |
| Delete others' shouts | Moderators. Everyone can already delete their own shouts without this. |

Reading the shoutbox is tied to Flarum's own **View forum** permission. If a group cannot view the forum, it gets no shouts at all rather than a partial list, so a private forum stays private.

## How refreshing works

An open shoutbox asks the server for new messages every **Refresh interval** seconds. There is no WebSocket connection, which is what keeps it dependency free, and it is also why a message is not instant.

Three behaviours are worth knowing when you pick an interval:

- **Every open tab polls.** On a busy forum, a short interval multiplied by many readers is real load. That is why the range stops at 10 seconds, and why raising it is the first thing to try if the shoutbox is straining the server.
- **A backgrounded tab stops asking**, and refreshes the moment it is focused again. Someone returning to the tab sees the current state immediately.
- **Failures back off.** If requests start failing, the gap between attempts grows to at most four times the configured interval, so a struggling server is not hammered. It returns to normal once a request succeeds.

## Styling

The widget uses Flarum 2's CSS custom properties (`var(--primary-color)`, `var(--text-color)` and friends), so it follows your theme without configuration.

The send button adapts to where it sits, detected from its parent:

- Inside `.sideNav`, `.IndexPage-nav` or `.FofWidgets-sideNavAlt`: an icon-only square button.
- Anywhere else (top, bottom, full-width sections): icon plus a "Send" label.

To override anything, target `.ShoutboxWidget` and its modifier classes from your custom Less in **Admin → Appearance**.

## Requirements

- Flarum **2.0** or later
- PHP **8.3** or later
- [`fof/forum-widgets-core`](https://github.com/FriendsOfFlarum/forum-widgets-core) **2.0.0-beta.3** or later. Composer installs it with this extension whichever display mode you pick, so it is a requirement even if you only want the `/shoutbox` page.

## Troubleshooting

**The widget is missing from the `fof/forum-widgets-core` config page.**
Run `php flarum cache:clear` and reload the admin page. If it is still missing, check the extension is enabled under **Extensions**, and that Display mode is not set to "Page only".

**A 500 error on the homepage after enabling.**
Almost always a migration that has not run. Run `php flarum migrate`. If it persists, read `storage/logs/flarum-YYYY-MM-DD.log` for the real exception.

**Shouts post, but take a while to appear for everyone else.**
That is the refresh interval doing its job, 30 seconds by default. Lower it in the settings if you want faster updates, keeping in mind that every open tab polls. If the delay is much longer than the interval, open the browser's network tab and look for failing `GET /api/shoutbox` requests, which will have triggered the back-off.

**Someone cannot post.**
Check they have the **Post shouts** permission, and that they are not inside the cooldown window from their last shout.

## Installation

```
composer require linkrobins/shoutbox
php flarum migrate
php flarum cache:clear
```

Then enable **Link Robins Shoutbox** in **Admin → Extensions**. For the widget, open the `fof/forum-widgets-core` settings and place it where you want it.

## License

MIT
