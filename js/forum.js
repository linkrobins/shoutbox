'use strict';

(function () {
    function formatTime(iso) {
        if (!iso) return '';
        var d    = new Date(iso);
        var diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60)    return diff + 's';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        return d.toLocaleDateString();
    }

    function avatarColor(name) {
        var colors = ['#4a6fa5','#e07b54','#5a9e6f','#9b59b6','#e67e22','#1abc9c','#e74c3c','#3498db'];
        var hash = 0;
        for (var i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }

    function buildUserMap(included) {
        var map = {};
        (included || []).forEach(function (r) {
            if (r.type === 'users') map[r.id] = r.attributes || {};
        });
        return map;
    }

    function userRoute(user) {
        try {
            return app.route('user', { username: user.slug || user.displayName });
        } catch (e) {
            return null;
        }
    }

    function getHeight() {
        var h = parseInt(app.forum.attribute('shoutboxHeight') || '320', 10);
        return isNaN(h) || h < 100 ? 320 : h;
    }

    app.initializers.add('linkrobins/shoutbox', function () {
        if (!app.widgets) return;

        var Component = flarum.reg.get('core', 'common/Component');
        if (!Component) return;

        class ShoutboxWidget extends Component {

            oninit(vnode) {
                super.oninit(vnode);
                this.shouts    = [];
                this.userMap   = {};
                this.loading   = true;
                this.sending   = false;
                this.loadError = false;
                this.input     = '';
                this._poll     = null;
                this._load();
            }

            onremove(vnode) {
                if (this._poll) clearInterval(this._poll);
            }

            _load() {
                this.loading = true;
                app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/shoutbox' })
                    .then((res) => {
                        this.shouts    = res.data || [];
                        this.userMap   = buildUserMap(res.included);
                        this.loading   = false;
                        this.loadError = false;
                        m.redraw();
                        setTimeout(() => this._scrollBottom(), 50);
                        if (!this._poll) {
                            this._poll = setInterval(() => {
                                app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/shoutbox' })
                                    .then((res) => {
                                        this.shouts  = res.data || [];
                                        this.userMap = buildUserMap(res.included);
                                        m.redraw();
                                    }).catch((e) => { console.error('[linkrobins/shoutbox] poll refresh failed', e); });
                            }, 15000);
                        }
                    })
                    .catch((e) => {
                        console.error('[linkrobins/shoutbox] initial load failed', e);
                        this.loading   = false;
                        this.loadError = true;
                        m.redraw();
                    });
            }

            _scrollBottom() {
                var el = this.element && this.element.querySelector('.ShoutboxWidget-messages');
                if (el) el.scrollTop = el.scrollHeight;
            }

            _send() {
                var content = this.input.trim();
                if (!content || this.sending) return;
                this.sending = true;
                app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/shoutbox', body: { content } })
                    .then((res) => {
                        this.shouts.push(res.data);
                        (res.included || []).forEach((r) => {
                            if (r.type === 'users') this.userMap[r.id] = r.attributes || {};
                        });
                        this.input   = '';
                        this.sending = false;
                        m.redraw();
                        setTimeout(() => this._scrollBottom(), 30);
                    })
                    .catch(() => { this.sending = false; m.redraw(); });
            }

            _delete(id) {
                if (!confirm(app.translator.trans('linkrobins-shoutbox.forum.widget.delete_confirm'))) return;
                var index   = this.shouts.findIndex((s) => s.id === id);
                var removed = index === -1 ? null : this.shouts[index];
                this.shouts = this.shouts.filter((s) => s.id !== id);
                m.redraw();
                app.request({ method: 'DELETE', url: app.forum.attribute('apiUrl') + '/shoutbox/' + id })
                    .catch((e) => {
                        console.error('[linkrobins/shoutbox] delete failed', e);
                        // Restore the optimistically-removed row and let the user know.
                        if (removed && this.shouts.indexOf(removed) === -1) {
                            this.shouts.splice(index, 0, removed);
                        }
                        m.redraw();
                        if (app.alerts) {
                            app.alerts.show(
                                { type: 'error' },
                                app.translator.trans('linkrobins-shoutbox.forum.widget.delete_error')
                            );
                        }
                    });
            }

            view() {
                var loggedIn  = app.session && app.session.user;
                var height    = getHeight();

                var msgContent;
                if (this.loading) {
                    msgContent = m('div', { className: 'ShoutboxWidget-empty' },
                        m('i', { className: 'fas fa-spinner fa-spin' }));
                } else if (this.loadError) {
                    msgContent = m('div', { className: 'ShoutboxWidget-empty ShoutboxWidget-error' },
                        app.translator.trans('linkrobins-shoutbox.forum.widget.load_error'));
                } else if (!this.shouts.length) {
                    msgContent = m('div', { className: 'ShoutboxWidget-empty' },
                        loggedIn ? '💬' : '');
                } else {
                    msgContent = m('div', {
                        className: 'ShoutboxWidget-messages',
                        style: 'height:' + height + 'px',
                    },
                        this.shouts.map((shout) => {
                            var attrs  = shout.attributes || {};
                            var userId = shout.relationships && shout.relationships.user && shout.relationships.user.data
                                ? shout.relationships.user.data.id : null;
                            var user   = userId ? (this.userMap[userId] || {}) : {};
                            var name   = user.displayName || 'User';
                            var avatar = user.avatarUrl;
                            var href   = userId && user.slug ? userRoute(user) : null;

                            return m('div', { className: 'ShoutboxWidget-message', key: shout.id },
                                avatar
                                    ? m('img', { className: 'ShoutboxWidget-message-avatar', src: avatar, alt: '' })
                                    : m('div', {
                                        className: 'ShoutboxWidget-message-avatar',
                                        style: 'background:' + avatarColor(name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.75rem;border-radius:50%;width:26px;height:26px;flex-shrink:0;'
                                      }, name.charAt(0).toUpperCase()),

                                m('div', { className: 'ShoutboxWidget-message-body' },
                                    m('div', { className: 'ShoutboxWidget-message-meta' },
                                        href
                                            ? m('a', { className: 'ShoutboxWidget-message-username', href }, name)
                                            : m('span', { className: 'ShoutboxWidget-message-username' }, name),
                                        m('span', { className: 'ShoutboxWidget-message-time' }, formatTime(attrs.createdAt))
                                    ),
                                    m('div', { className: 'ShoutboxWidget-message-text' }, attrs.content)
                                ),

                                attrs.canDelete
                                    ? m('button', {
                                        className: 'ShoutboxWidget-message-delete',
                                        title: app.translator.trans('linkrobins-shoutbox.forum.widget.delete'),
                                        onclick: () => this._delete(shout.id),
                                      }, m('i', { className: 'fas fa-times' }))
                                    : null
                            );
                        })
                    );
                }

                var inputArea;
                if (loggedIn) {
                    inputArea = m('div', { className: 'ShoutboxWidget-form' },
                        m('input', {
                            type:        'text',
                            maxlength:   280,
                            placeholder: app.translator.trans('linkrobins-shoutbox.forum.widget.placeholder'),
                            value:       this.input,
                            oninput:  (e) => { this.input = e.target.value; },
                            onkeydown: (e) => { if (e.key === 'Enter') this._send(); },
                            disabled: this.sending,
                        }),
                        m('button', {
                            onclick:  () => this._send(),
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
                    inputArea = m('div', { className: 'ShoutboxWidget-login-hint' },
                        app.translator.trans('linkrobins-shoutbox.forum.widget.login_to_shout')
                    );
                }

                return m('div', { className: 'FofWidgets-Widget ShoutboxWidget' },
                    m('div', { className: 'FofWidgets-Widget-title' },
                        m('span', { className: 'FofWidgets-Widget-title-icon' },
                            m('i', { className: 'fas fa-comments' })
                        ),
                        m('span', { className: 'FofWidgets-Widget-title-label' },
                            app.translator.trans('linkrobins-shoutbox.forum.widget.title')
                        )
                    ),
                    m('div', { className: 'FofWidgets-Widget-content' },
                        msgContent,
                        inputArea
                    )
                );
            }
        }

        app.widgets.add({
            key:        'linkrobins-shoutbox',
            component:  ShoutboxWidget,
            placement:  'start_top',
            isUnique:   true,
            isDisabled: false,
        }, 'linkrobins-shoutbox');
    });

})();
