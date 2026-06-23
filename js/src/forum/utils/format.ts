import app from 'flarum/forum/app';

// Compact relative time. Called from view() (render time), so resolving the
// translator here is safe and locale-correct. The suffixes are translatable;
// the date fallback uses the forum's locale. Accepts a Date (from the store
// model's createdAt()) or an ISO string.
export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return app.translator.trans('linkrobins-shoutbox.forum.widget.time_seconds', { count: diff }) as string;
  if (diff < 3600) return app.translator.trans('linkrobins-shoutbox.forum.widget.time_minutes', { count: Math.floor(diff / 60) }) as string;
  if (diff < 86400) return app.translator.trans('linkrobins-shoutbox.forum.widget.time_hours', { count: Math.floor(diff / 3600) }) as string;
  return d.toLocaleDateString((app as any).data?.locale || undefined);
}

export function avatarColor(name: string): string {
  const colors = ['#4a6fa5', '#e07b54', '#5a9e6f', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Profile link for a sideloaded User model.
export function userRoute(user: any): string | null {
  try {
    return app.route('user', { username: user.slug() });
  } catch (e) {
    return null;
  }
}

export function getHeight(): number {
  const h = parseInt(app.forum.attribute('shoutboxHeight') || '320', 10);
  return isNaN(h) || h < 100 ? 320 : h;
}

// Admin-controlled placement: 'both' (page + widget), 'widget' (widget only),
// or 'page' (page only). Unknown/missing values fall back to 'both'.
//
// This is read both at render time (app.forum exists) and inside the app
// initializer -- and in Flarum 2.0 app.forum is NOT yet built when initializers
// run, so we fall back to the raw boot payload (app.data.resources) there.
export function displayMode(): 'both' | 'widget' | 'page' {
  let mode: any;
  if (app.forum) {
    mode = app.forum.attribute('shoutboxDisplayMode');
  } else {
    const data = (app as any).data;
    const forum = data && data.resources && data.resources.find((r: any) => r.type === 'forums');
    mode = forum && forum.attributes ? forum.attributes.shoutboxDisplayMode : undefined;
  }
  return mode === 'widget' || mode === 'page' ? mode : 'both';
}
