import app from 'flarum/forum/app';
import m from 'mithril';
import type Mithril from 'mithril';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Shout from '../models/Shout';
import { formatTime, avatarColor, userRoute, getHeight, messageOrder, composerPosition, pollInterval } from '../utils/format';

// Failure back-off is capped at four times the configured refresh interval.
const POLL_BACKOFF_FACTOR = 4;

export interface ShoutboxChatAttrs extends ComponentAttrs {
  /** Fixed height for the message list, in pixels (the widget passes this). */
  height?: number;
  /** Let the message list grow to fill its container instead (the page). */
  fill?: boolean;
}

// Shared chat: data loading + polling + optimistic send/delete, plus the
// message list and composer. Used by both the sidebar widget and the page.
//
// Reads/writes go through app.store ('shouts' model), so users are sideloaded
// and the store stays consistent. The poll is a self-scheduling timeout that
// pauses while the tab is hidden and backs off on consecutive failures.
export default class ShoutboxChat extends Component<ShoutboxChatAttrs> {
  shouts!: Shout[];
  loading!: boolean;
  sending!: boolean;
  loadError!: boolean;
  input!: string;
  private _poll: ReturnType<typeof setTimeout> | null = null;
  private _delay = pollInterval();
  private _failures = 0;
  private _inputEl: HTMLInputElement | null = null;

  // Resume immediately (at the base interval) when the tab becomes visible
  // again, so a backgrounded shoutbox refreshes the moment it's focused.
  private _onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (this._poll) clearTimeout(this._poll);
      this._poll = null;
      this._delay = pollInterval();
      this._failures = 0;
      this._pollTick();
    }
  };

  oninit(vnode: Mithril.Vnode<ShoutboxChatAttrs, this>) {
    super.oninit(vnode);
    this.shouts = [];
    this.loading = true;
    this.sending = false;
    this.loadError = false;
    this.input = '';
    this._poll = null;
    this._delay = pollInterval();
    this._failures = 0;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisible);
    this._load();
  }

  onremove(vnode: Mithril.Vnode<ShoutboxChatAttrs, this>) {
    super.onremove(vnode);
    if (this._poll) clearTimeout(this._poll);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVisible);
  }

  private _query() {
    return app.store.find('shouts', { sort: '-createdAt', include: 'user' });
  }

  private _newestFirst() {
    return messageOrder() === 'newest_first';
  }

  // The API always returns shouts newest-first. In the default order the list
  // renders oldest-first and scrolls to the newest at the bottom; in
  // newest-first order the API order is kept and the newest sits at the top.
  private _apply(shouts: Shout[]) {
    const list = (shouts || []).slice();
    this.shouts = this._newestFirst() ? list : list.reverse();
  }

  _load() {
    this.loading = true;
    this._query()
      .then((shouts: Shout[]) => {
        this._apply(shouts);
        this.loading = false;
        this.loadError = false;
        this._failures = 0;
        this._delay = pollInterval();
        m.redraw();
        setTimeout(() => this._scrollToNewest(), 50);
        this._schedulePoll();
      })
      .catch((e: unknown) => {
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
  // interval, on failure back off exponentially up to the back-off cap.
  private _pollTick() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this._schedulePoll();
      return;
    }
    const base = pollInterval();
    this._query()
      .then((shouts: Shout[]) => {
        this._failures = 0;
        this._delay = base;
        this._apply(shouts);
        m.redraw();
      })
      .catch((e: unknown) => {
        this._failures++;
        this._delay = Math.min(base * Math.pow(2, this._failures), base * POLL_BACKOFF_FACTOR);
        console.error('[linkrobins/shoutbox] poll refresh failed', e);
      })
      .then(() => this._schedulePoll());
  }

  // Scroll the message list to wherever the newest shout lives: the bottom in
  // the default order, the top when newest-first is enabled.
  _scrollToNewest() {
    const el = this.element && this.element.querySelector('.ShoutboxWidget-messages');
    if (el) el.scrollTop = this._newestFirst() ? 0 : el.scrollHeight;
  }

  // Put the cursor back in the input after a send so you can keep typing
  // without clicking. The input is disabled while sending, which drops focus,
  // so this runs once the redraw has re-enabled it. Skipped if the user has
  // meanwhile focused something outside the shoutbox.
  _focusInput() {
    const el = this._inputEl;
    if (!el || !document.contains(el) || el.disabled) return;
    const active = document.activeElement;
    if (active && active !== document.body && this.element && !this.element.contains(active)) return;
    el.focus();
  }

  _send() {
    const content = this.input.trim();
    if (!content || this.sending) return;
    this.sending = true;
    app.store
      .createRecord('shouts')
      .save({ content })
      .then((shout: Shout) => {
        if (this._newestFirst()) this.shouts.unshift(shout);
        else this.shouts.push(shout);
        this.input = '';
        this.sending = false;
        m.redraw();
        setTimeout(() => {
          this._scrollToNewest();
          this._focusInput();
        }, 30);
      })
      .catch((e: any) => {
        this.sending = false;
        m.redraw();
        // Keep the (unsent) text and the cursor where they were so the shout
        // can be retried without retyping it.
        setTimeout(() => this._focusInput(), 30);
        // Surface flood-control / validation rejection (the cooldown returns
        // 422 from the resource) so the failure isn't silent.
        const status = e && (e.status || (e.response && e.response.status));
        if ((status === 422 || status === 429 || status === '422' || status === '429') && app.alerts) {
          app.alerts.show({ type: 'error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.rate_limited'));
        }
      });
  }

  _delete(shout: Shout) {
    if (!confirm(app.translator.trans('linkrobins-shoutbox.forum.widget.delete_confirm') as string)) return;
    const index = this.shouts.indexOf(shout);
    if (index === -1) return;
    this.shouts = this.shouts.filter((s) => s !== shout);
    m.redraw();
    shout.delete().catch((e: unknown) => {
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
    const fill = !!this.attrs.fill;
    const newestFirst = this._newestFirst();
    // By default the input sits next to the newest message (top when
    // newest-first is on), so a new shout appears right under the box it was
    // typed in. Admins can pin it to either side instead.
    const composerTop = composerPosition() === 'top';
    const parts = [this._renderMessages(fill), this._renderComposer()];
    return m(
      'div',
      {
        className:
          'ShoutboxChat' +
          (fill ? ' ShoutboxChat--fill' : '') +
          (newestFirst ? ' ShoutboxChat--newestFirst' : '') +
          (composerTop ? ' ShoutboxChat--composerTop' : ''),
      },
      composerTop ? parts.reverse() : parts
    );
  }

  _renderMessages(fill: boolean) {
    const loggedIn = app.session && app.session.user;
    const height = this.attrs.height || getHeight();

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

  _renderMessage(shout: Shout) {
    const user = shout.user && shout.user();
    const name =
      (user && user.displayName && user.displayName()) || (app.translator.trans('linkrobins-shoutbox.forum.widget.unknown_user') as string);
    const avatar = user && user.avatarUrl ? user.avatarUrl() : null;
    const href = user ? userRoute(user) : null;

    return m(
      'div',
      { className: 'ShoutboxWidget-message', key: shout.id() },
      avatar
        ? m('img', { className: 'ShoutboxWidget-message-avatar', src: avatar, alt: '' })
        : // Only the generated colour is inline; the rest of the initials
          // avatar is styled in forum.less so themes can override it.
          m(
            'div',
            {
              className: 'ShoutboxWidget-message-avatar ShoutboxWidget-message-avatar--initials',
              style: 'background:' + avatarColor(name),
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
      return m('div', { className: 'ShoutboxWidget-login-hint' }, app.translator.trans('linkrobins-shoutbox.forum.widget.login_to_shout'));
    }
    return m(
      'div',
      { className: 'ShoutboxWidget-form' },
      m('input', {
        type: 'text',
        maxlength: 280,
        placeholder: app.translator.trans('linkrobins-shoutbox.forum.widget.placeholder'),
        value: this.input,
        oncreate: (vnode: Mithril.VnodeDOM) => {
          this._inputEl = vnode.dom as HTMLInputElement;
        },
        onremove: () => {
          this._inputEl = null;
        },
        oninput: (e: InputEvent) => {
          this.input = (e.target as HTMLInputElement).value;
        },
        onkeydown: (e: KeyboardEvent) => {
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
              m('span', { className: 'ShoutboxWidget-send-label' }, ' ' + app.translator.trans('linkrobins-shoutbox.forum.widget.send')),
            ]
      )
    );
  }
}
