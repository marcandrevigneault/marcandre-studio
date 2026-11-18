# Inline page builder

User selected editing directly on the page with an administrator toolbar.
First scope is Home, Projects index, and About. Preserve their existing content,
French default/English variants, and unavailable section cards. Video QR and
its existing inline text editor remain separate.

Use a structured block editor integrated into the existing Astro/React site.
Alternative separate admin canvas was offered; user selected in-page editing.
Blocks: hero, text, image, native video, button, columns, cards. Reorder via drag
handles and accessible move buttons; edit text directly and settings in a side
panel. Common controls: foreground/background colors, spacing, alignment,
width, background image; images/videos use selectable known site assets or
HTTPS media URLs. No arbitrary scripts, raw HTML or iframe embeds.

Public SSR markup and editor use one shared block renderer/CSS. Only authenticated
admins outside visitor-preview mode can open builder. Page language can be edited
independently. Toolbar provides undo/redo, mobile preview, private draft save,
publish and exit. Unsaved changes require confirmation on exit/navigation.

Private D1 drafts use optimistic revisions and retain their publication base SHA.
Published JSON commits through existing GitHub credentials trigger Vercel builds.
Validate all schemas/URLs on server; enforce same-origin POST, admin sessions,
body limits, page allowlist and exact revision conflicts. Never overwrite newer
content silently. Failed writes preserve local work. No redesign of the site or
public tracking change is part of this task.
