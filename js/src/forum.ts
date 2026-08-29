import app from 'flarum/forum/app';
import m from 'mithril';
import LinkButton from 'flarum/common/components/LinkButton';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import { extend } from 'flarum/common/extend';
import Shout from './forum/models/Shout';
import ShoutboxPage from './forum/components/ShoutboxPage';
import ShoutboxWidget from './forum/components/ShoutboxWidget';
import { canView, displayMode } from './forum/utils/format';

app.initializers.add('linkrobins/shoutbox', () => {
  // Register the 'shouts' model so app.store.find()/createRecord() return typed,
  // cached records with the user relationship sideloaded.
  app.store.models.shouts = Shout;

  const mode = displayMode();
  const showPage = mode === 'both' || mode === 'page';
  const showWidget = mode === 'both' || mode === 'widget';

  // Page route + sidebar nav link — only when the page is enabled. When it's
  // off, /shoutbox has no client route and mithril falls back to home.
  if (showPage) {
    app.routes['linkrobins-shoutbox'] = { path: '/shoutbox', component: ShoutboxPage };

    // Index sidebar nav link (visible to everyone).
    extend(IndexSidebar.prototype, 'navItems', function (this: any, items: any) {
      if (!canView()) return;

      items.add(
        'linkrobins-shoutbox',
        m(LinkButton, { href: app.route('linkrobins-shoutbox'), icon: 'fas fa-bullhorn' }, app.translator.trans('linkrobins-shoutbox.forum.nav')),
        20
      );
    });
  }

  // Sidebar widget — only when enabled and fof/forum-widgets-core is installed.
  const widgets = (app as any).widgets;
  if (widgets && showWidget) {
    widgets.add(
      {
        key: 'linkrobins-shoutbox',
        component: ShoutboxWidget,
        placement: 'start_top',
        isUnique: true,
        isDisabled: false,
      },
      'linkrobins-shoutbox'
    );
  }
});
