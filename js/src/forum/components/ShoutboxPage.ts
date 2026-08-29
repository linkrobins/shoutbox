import app from 'flarum/forum/app';
import m from 'mithril';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import ShoutboxChat from './ShoutboxChat';
import { canView } from '../utils/format';

// Standalone page at /shoutbox.
export default class ShoutboxPage extends Page {
  oninit(vnode: any) {
    super.oninit(vnode);
    try {
      app.setTitle(app.translator.trans('linkrobins-shoutbox.forum.page_title') as string);
    } catch (e) {
      // setTitle is cosmetic; if it ever throws (e.g. during teardown), log it
      // rather than swallowing the error silently.
      console.warn('[linkrobins/shoutbox] setTitle failed', e);
    }
  }

  view() {
    // Server-side, /shoutbox 404s without the permission; this covers SPA
    // navigation with a stale payload.
    if (!canView()) return m('div');
    const content = m('div', { className: 'ShoutboxPage-container' }, [
      m(
        'div',
        { className: 'ShoutboxPage-header' },
        m('h1', { className: 'ShoutboxPage-title' }, [
          m('i', { className: 'fas fa-bullhorn' }),
          ' ',
          app.translator.trans('linkrobins-shoutbox.forum.page_title'),
        ])
      ),
      m('div', { className: 'ShoutboxPage-chat' }, m(ShoutboxChat, { fill: true })),
    ]);

    return m(
      PageStructure,
      {
        className: 'IndexPage ShoutboxPage',
        sidebar: () => m(IndexSidebar),
      },
      content
    );
  }
}
