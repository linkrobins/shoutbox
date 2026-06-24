import app from 'flarum/forum/app';
import m from 'mithril';
import Component from 'flarum/common/Component';
import { formatTime, avatarColor, userRoute, getHeight } from '../utils/format';

// Default refresh interval, and the cap for failure back-off.
const POLL_BASE = 30000; // 30s
const POLL_MAX = 120000; // 2 min

// Shared chat: data loading + polling + optimistic send/delete, plus the
// message list and composer. Used by both the sidebar widget and the page.
// Attrs: { height?: number; fill?: boolean }.
//
// Reads/writes go through app.store ('shouts' model), so users are sideloaded
// and the store stays consistent. The poll is a self-scheduling timeout that
// pauses while the tab is hidden and backs off on consecutive failures.
export default class ShoutboxChat extends Component {
  shouts!: any[];
  loading!: boolean;
  sending!: boolean;
  loadError!: boolean;
  input!: string;
  private _poll: any = null;
  private _delay = POLL_BASE;
  private _failures = 0;

  // Resume immediately (at the base interval) when the tab becomes visible
  // again, so a backgrounded shoutbox refreshes the moment it's focused.
  private _onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (this._poll) clearTimeout(this._poll);
      this._poll = null;
      this._delay = POLL_BASE;
      this._failures = 0;
      this._pollTick();
    }
  };

  oninit(vnode: any) {
    super.oninit(vnode);
    this.shouts = [];
    this.loading = true;
    this.sending = false;
    this.loadError = false;
    this.input = '';
    this._poll = null;
    this._delay = POLL_BASE;
    this._failures = 0;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisible);
    this._load();
  }

  onremove(vnode: any) {
    super.onremove(vnode);
    if (this._poll) clearTimeout(this._poll);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVisible);
  }

  private _query() {
    return app.store.find('shouts', { sort: '-createdAt', include: 'user' });
  }

  // The API returns shouts newest-first; the list renders oldest-first and
  // scrolls to the newest at the bottom.
  private _apply(shouts: any[]) {
    this.shouts = (shouts || []).slice().reverse();
  }

  _load() {
    this.loading = true;
    this._query()
      .then((shouts: any[]) => {
        this._apply(shouts);
        this.loading = false;
        this.loadError = false;
        this._failures = 0;
        this._delay = POLL_BASE;
        m.redraw();
        setTimeout(() => this._scrollBottom(), 50);
        this._schedulePoll();
      })
      .catch((e: any) => {
        console.error('[linkrobins/shoutbox] initial load failed', e);
        this.loading = false;
        this.loadError = true;
        m.redraw();
      });
  }

  private _schedulePoll() {
    if (this._poll) clearTimeout(this._poll);
    this._poll = setTimeout(() => this._pollTick(), this._delay);
  }

  // One poll cycle: skip (but reschedule) while hidden; on success reset the
  // interval, on failure back off exponentially up to POLL_MAX.
  private _pollTick() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this._schedulePoll();
      return;
    }
    this._query()
      .then((shouts: any[]) => {
        this._failures = 0;
        this._delay = POLL_BASE;
        this._apply(shouts);
        m.redraw();
      })
      .catch((e: any) => {
        this._failures++;
        this._delay = Math.min(POLL_BASE * Math.pow(2, this._failures), POLL_MAX);
        console.error('[linkrobins/shoutbox] poll refresh failed', e);
      })
      .then(() => this._schedulePoll());
  }

  _scrollBottom() {
    const el = this.element && this.element.querySelector('.ShoutboxWidget-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  _send() {
    const content = this.input.trim();
    if (!content || this.sending) return;
    this.sending = true;
    app.store
      .createRecord('shouts')
      .save({ content })
      .then((shout: any) => {
        this.shouts.push(shout);
        this.input = '';
        this.sending = false;
        m.redraw();
        setTimeout(() => this._scrollBottom(), 30);
      })
      .catch((e: any) => {
        this.sending = false;
        m.redraw();
        // Surface flood-control / validation rejection (cooldown returns 422
        // from the resource) so the failure isn't silent.
        const status = e && (e.status || (e.response && e.response.status));
        if ((status === 422 || status === 429 || status === '422' || status === '429') && app.alerts) {
          app.alerts.show({ type: 'error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.rate_limited'));
        }
      });
  }

  _delete(shout: any) {
    if (!confirm(app.translator.trans('linkrobins-shoutbox.forum.widget.delete_confirm') as string)) return;
    const index = this.shouts.indexOf(shout);
    if (index === -1) return;
    this.shouts = this.shouts.filter((s) => s !== shout);
    m.redraw();
    shout.delete().catch((e: any) => {
      console.error('[linkrobins/shoutbox] delete failed', e);
      // Roll the optimistic removal back if the request failed.
      if (this.shouts.indexOf(shout) === -1) this.shouts.splice(index, 0, shout);
      m.redraw();
      if (app.alerts) {
        app.alerts.show({ type: 'error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.delete_error'));
      }
    });
  }

  view() {
    const fill = !!(this.attrs as any).fill;
    return m('div', { className: 'ShoutboxChat' + (fill ? ' ShoutboxChat--fill' : '') }, [
      this._renderMessages(fill),
      this._renderComposer(),
    ]);
  }

  _renderMessages(fill: boolean) {
    const loggedIn = app.session && app.session.user;
    const height = (this.attrs as any).height || getHeight();

    if (this.loading) {
      return m('div', { className: 'ShoutboxWidget-empty' }, m('i', { className: 'fas fa-spinner fa-spin' }));
    }
    if (this.loadError) {
      return m(
        'div',
        { className: 'ShoutboxWidget-empty ShoutboxWidget-error' },
        app.translator.trans('linkrobins-shoutbox.forum.widget.load_error')
      );
    }
    if (!this.shouts.length) {
      return m('div', { className: 'ShoutboxWidget-empty' }, loggedIn ? '💬' : '');
    }
    return m(
      'div',
      {
        className: 'ShoutboxWidget-messages' + (fill ? ' ShoutboxWidget-messages--fill' : ''),
        style: fill ? null : 'height:' + height + 'px',
      },
      this.shouts.map((shout) => this._renderMessage(shout))
    );
  }

  _renderMessage(shout: any) {
    const user = shout.user && shout.user();
    const name =
      (user && user.displayName && user.displayName()) ||
      (app.translator.trans('linkrobins-shoutbox.forum.widget.unknown_user') as string);
    const avatar = user && user.avatarUrl ? user.avatarUrl() : null;
    const href = user ? userRoute(user) : null;

    return m(
      'div',
      { className: 'ShoutboxWidget-message', key: shout.id() },
      avatar
        ? m('img', { className: 'ShoutboxWidget-message-avatar', src: avatar, alt: '' })
        : m(
            'div',
            {
              className: 'ShoutboxWidget-message-avatar',
              style:
                'background:' +
                avatarColor(name) +
                ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.75rem;border-radius:50%;width:26px;height:26px;flex-shrink:0;',
            },
            name.charAt(0).toUpperCase()
          ),
      m(
        'div',
        { className: 'ShoutboxWidget-message-body' },
        m(
          'div',
          { className: 'ShoutboxWidget-message-meta' },
          href
            ? m('a', { className: 'ShoutboxWidget-message-username', href }, name)
            : m('span', { className: 'ShoutboxWidget-message-username' }, name),
          m('span', { className: 'ShoutboxWidget-message-time' }, formatTime(shout.createdAt()))
        ),
        // FontSizer-text opts this in to linkrobins/font-sizer's reading-size
        // control (a no-op when that extension isn't installed).
        m('div', { className: 'ShoutboxWidget-message-text FontSizer-text' }, shout.content())
      ),
      shout.canDelete && shout.canDelete()
        ? m(
            'button',
            {
              className: 'ShoutboxWidget-message-delete',
              title: app.translator.trans('linkrobins-shoutbox.forum.widget.delete'),
              onclick: () => this._delete(shout),
            },
            m('i', { className: 'fas fa-times' })
          )
        : null
    );
  }

  _renderComposer() {
    const loggedIn = app.session && app.session.user;
    if (!loggedIn) {
      return m(
        'div',
        { className: 'ShoutboxWidget-login-hint' },
        app.translator.trans('linkrobins-shoutbox.forum.widget.login_to_shout')
      );
    }
    return m(
      'div',
      { className: 'ShoutboxWidget-form' },
      m('input', {
        type: 'text',
        maxlength: 280,
        placeholder: app.translator.trans('linkrobins-shoutbox.forum.widget.placeholder'),
        value: this.input,
        oninput: (e: any) => {
          this.input = e.target.value;
        },
        onkeydown: (e: any) => {
          if (e.key === 'Enter') this._send();
        },
        disabled: this.sending,
      }),
      m(
        'button',
        {
          onclick: () => this._send(),
          disabled: this.sending || !this.input.trim(),
        },
        this.sending
          ? m('i', { className: 'fas fa-spinner fa-spin' })
          : [
              m('i', { className: 'fas fa-paper-plane' }),
              m(
                'span',
                { className: 'ShoutboxWidget-send-label' },
                ' ' + app.translator.trans('linkrobins-shoutbox.forum.widget.send')
              ),
            ]
      )
    );
  }
}
