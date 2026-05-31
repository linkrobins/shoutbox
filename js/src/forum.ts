import app from 'flarum/forum/app';
import m from 'mithril';
import Component from 'flarum/common/Component';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import { extend } from 'flarum/common/extend';

function formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return d.toLocaleDateString();
}

function avatarColor(name: string): string {
    const colors = ['#4a6fa5', '#e07b54', '#5a9e6f', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function buildUserMap(included: any[]): Record<string, any> {
    const map: Record<string, any> = {};
    (included || []).forEach((r) => {
        if (r.type === 'users') map[r.id] = r.attributes || {};
    });
    return map;
}

function userRoute(user: any): string | null {
    try {
        return app.route('user', { username: user.slug || user.displayName });
    } catch (e) {
        return null;
    }
}

function getHeight(): number {
    const h = parseInt(app.forum.attribute('shoutboxHeight') || '320', 10);
    return isNaN(h) || h < 100 ? 320 : h;
}

// Shared chat: data loading + 15s polling + optimistic send/delete, plus the
// message list and composer. Used by both the sidebar widget and the page.
// Attrs: { height?: number; fill?: boolean }.
class ShoutboxChat extends Component {
    shouts!: any[];
    userMap!: Record<string, any>;
    loading!: boolean;
    sending!: boolean;
    loadError!: boolean;
    input!: string;
    private _poll: any = null;

    oninit(vnode: any) {
        super.oninit(vnode);
        this.shouts = [];
        this.userMap = {};
        this.loading = true;
        this.sending = false;
        this.loadError = false;
        this.input = '';
        this._poll = null;
        this._load();
    }

    onremove(vnode: any) {
        super.onremove(vnode);
        if (this._poll) clearInterval(this._poll);
    }

    // The API returns shouts newest-first (sort=-createdAt); the list renders
    // top-to-bottom oldest-first and scrolls to the newest at the bottom.
    private _apply(res: any) {
        this.shouts = (res.data || []).slice().reverse();
        this.userMap = buildUserMap(res.included);
    }

    _load() {
        this.loading = true;
        app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/shouts' })
            .then((res: any) => {
                this._apply(res);
                this.loading = false;
                this.loadError = false;
                m.redraw();
                setTimeout(() => this._scrollBottom(), 50);
                if (!this._poll) {
                    this._poll = setInterval(() => {
                        app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/shouts' })
                            .then((res: any) => {
                                this._apply(res);
                                m.redraw();
                            })
                            .catch((e: any) => console.error('[linkrobins/shoutbox] poll refresh failed', e));
                    }, 15000);
                }
            })
            .catch((e: any) => {
                console.error('[linkrobins/shoutbox] initial load failed', e);
                this.loading = false;
                this.loadError = true;
                m.redraw();
            });
    }

    _scrollBottom() {
        const el = this.element && this.element.querySelector('.ShoutboxWidget-messages');
        if (el) el.scrollTop = el.scrollHeight;
    }

    _send() {
        const content = this.input.trim();
        if (!content || this.sending) return;
        this.sending = true;
        app.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/shouts',
            body: { data: { type: 'shouts', attributes: { content } } },
        })
            .then((res: any) => {
                this.shouts.push(res.data);
                (res.included || []).forEach((r: any) => {
                    if (r.type === 'users') this.userMap[r.id] = r.attributes || {};
                });
                this.input = '';
                this.sending = false;
                m.redraw();
                setTimeout(() => this._scrollBottom(), 30);
            })
            .catch((e: any) => {
                this.sending = false;
                m.redraw();
                // Surface flood-control / validation rejection (cooldown now
                // returns 422 from the resource) so the failure isn't silent.
                const status = e && (e.status || (e.response && e.response.status));
                if ((status === 422 || status === 429 || status === '422' || status === '429') && app.alerts) {
                    app.alerts.show({ type: 'error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.rate_limited'));
                }
            });
    }

    _delete(id: string) {
        if (!confirm(app.translator.trans('linkrobins-shoutbox.forum.widget.delete_confirm') as string)) return;
        const index = this.shouts.findIndex((s) => s.id === id);
        const removed = index === -1 ? null : this.shouts[index];
        this.shouts = this.shouts.filter((s) => s.id !== id);
        m.redraw();
        app.request({ method: 'DELETE', url: app.forum.attribute('apiUrl') + '/shouts/' + id }).catch((e: any) => {
            console.error('[linkrobins/shoutbox] delete failed', e);
            if (removed && this.shouts.indexOf(removed) === -1) {
                this.shouts.splice(index, 0, removed);
            }
            m.redraw();
            if (app.alerts) {
                app.alerts.show({ type: 'error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.delete_error'));
            }
        });
    }

    view() {
        const loggedIn = app.session && app.session.user;
        const fill = !!(this.attrs as any).fill;
        const height = (this.attrs as any).height || getHeight();

        let msgContent;
        if (this.loading) {
            msgContent = m('div', { className: 'ShoutboxWidget-empty' }, m('i', { className: 'fas fa-spinner fa-spin' }));
        } else if (this.loadError) {
            msgContent = m('div', { className: 'ShoutboxWidget-empty ShoutboxWidget-error' }, app.translator.trans('linkrobins-shoutbox.forum.widget.load_error'));
        } else if (!this.shouts.length) {
            msgContent = m('div', { className: 'ShoutboxWidget-empty' }, loggedIn ? '💬' : '');
        } else {
            msgContent = m(
                'div',
                {
                    className: 'ShoutboxWidget-messages' + (fill ? ' ShoutboxWidget-messages--fill' : ''),
                    style: fill ? null : 'height:' + height + 'px',
                },
                this.shouts.map((shout) => {
                    const attrs = shout.attributes || {};
                    const userId =
                        shout.relationships && shout.relationships.user && shout.relationships.user.data
                            ? shout.relationships.user.data.id
                            : null;
                    const user = userId ? this.userMap[userId] || {} : {};
                    const name = user.displayName || 'User';
                    const avatar = user.avatarUrl;
                    const href = userId && user.slug ? userRoute(user) : null;

                    return m(
                        'div',
                        { className: 'ShoutboxWidget-message', key: shout.id },
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
                                m('span', { className: 'ShoutboxWidget-message-time' }, formatTime(attrs.createdAt))
                            ),
                            m('div', { className: 'ShoutboxWidget-message-text' }, attrs.content)
                        ),
                        attrs.canDelete
                            ? m(
                                  'button',
                                  {
                                      className: 'ShoutboxWidget-message-delete',
                                      title: app.translator.trans('linkrobins-shoutbox.forum.widget.delete'),
                                      onclick: () => this._delete(shout.id),
                                  },
                                  m('i', { className: 'fas fa-times' })
                              )
                            : null
                    );
                })
            );
        }

        let inputArea;
        if (loggedIn) {
            inputArea = m(
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
                              m('span', { className: 'ShoutboxWidget-send-label' }, ' ' + app.translator.trans('linkrobins-shoutbox.forum.widget.send')),
                          ]
                )
            );
        } else {
            inputArea = m('div', { className: 'ShoutboxWidget-login-hint' }, app.translator.trans('linkrobins-shoutbox.forum.widget.login_to_shout'));
        }

        return m('div', { className: 'ShoutboxChat' + (fill ? ' ShoutboxChat--fill' : '') }, [msgContent, inputArea]);
    }
}

// Sidebar widget (fof/forum-widgets-core); its title links through to the page.
class ShoutboxWidget extends Component {
    view() {
        const title = app.translator.trans('linkrobins-shoutbox.forum.widget.title');
        return m(
            'div',
            { className: 'FofWidgets-Widget ShoutboxWidget' },
            m(
                'div',
                { className: 'FofWidgets-Widget-title' },
                m('span', { className: 'FofWidgets-Widget-title-icon' }, m('i', { className: 'fas fa-bullhorn' })),
                m(
                    'span',
                    { className: 'FofWidgets-Widget-title-label' },
                    m(
                        Link,
                        {
                            href: app.route('linkrobins-shoutbox'),
                            className: 'ShoutboxWidget-titleLink',
                            title: app.translator.trans('linkrobins-shoutbox.forum.page_title'),
                        },
                        title
                    )
                )
            ),
            m('div', { className: 'FofWidgets-Widget-content' }, m(ShoutboxChat, { height: getHeight() }))
        );
    }
}

// Standalone page at /shoutbox.
class ShoutboxPage extends Page {
    oninit(vnode: any) {
        super.oninit(vnode);
        try {
            app.setTitle(app.translator.trans('linkrobins-shoutbox.forum.page_title') as string);
        } catch (e) {}
    }

    view() {
        const content = m('div', { className: 'ShoutboxPage-container' }, [
            m(
                'div',
                { className: 'ShoutboxPage-header' },
                m('h1', { className: 'ShoutboxPage-title' }, [m('i', { className: 'fas fa-bullhorn' }), ' ', app.translator.trans('linkrobins-shoutbox.forum.page_title')])
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

app.initializers.add('linkrobins/shoutbox', () => {
    app.routes['linkrobins-shoutbox'] = { path: '/shoutbox', component: ShoutboxPage };

    // Sidebar widget — only when fof/forum-widgets-core is installed.
    const widgets = (app as any).widgets;
    if (widgets) {
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

    // Index sidebar nav link (visible to everyone).
    extend(IndexSidebar.prototype, 'navItems', function (this: any, items: any) {
        items.add(
            'linkrobins-shoutbox',
            m(LinkButton, { href: app.route('linkrobins-shoutbox'), icon: 'fas fa-bullhorn' }, app.translator.trans('linkrobins-shoutbox.forum.nav')),
            20
        );
    });
});
