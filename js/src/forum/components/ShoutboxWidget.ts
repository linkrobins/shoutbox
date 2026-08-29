import app from 'flarum/forum/app';
import m from 'mithril';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import ShoutboxChat from './ShoutboxChat';
import { canView, getHeight, displayMode } from '../utils/format';

// Sidebar widget (fof/forum-widgets-core); its title links through to the page.
export default class ShoutboxWidget extends Component {
  view() {
    // No permission, no widget — not even the empty card frame.
    if (!canView()) return null;

    const title = app.translator.trans('linkrobins-shoutbox.forum.widget.title');
    // Only link the title through to the page when the page is enabled;
    // otherwise the route isn't registered and app.route() would throw.
    const pageEnabled = displayMode() !== 'widget';
    const titleLabel = pageEnabled
      ? m(
          Link,
          {
            href: app.route('linkrobins-shoutbox'),
            className: 'ShoutboxWidget-titleLink',
            title: app.translator.trans('linkrobins-shoutbox.forum.page_title'),
          },
          title
        )
      : title;
    return m(
      'div',
      { className: 'FofWidgets-Widget ShoutboxWidget' },
      m(
        'div',
        { className: 'FofWidgets-Widget-title' },
        m('span', { className: 'FofWidgets-Widget-title-icon' }, m('i', { className: 'fas fa-bullhorn' })),
        m('span', { className: 'FofWidgets-Widget-title-label' }, titleLabel)
      ),
      m('div', { className: 'FofWidgets-Widget-content' }, m(ShoutboxChat, { height: getHeight() }))
    );
  }
}
