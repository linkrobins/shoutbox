import app from 'flarum/admin/app';

app.initializers.add('linkrobins/shoutbox', () => {
    const mode = app.data.settings['linkrobins-shoutbox.display_mode'] || 'both';
    const showWidget = mode === 'both' || mode === 'widget';

    // Register a no-op widget entry so fof/forum-widgets-core lists it (the
    // real widget lives in the forum frontend). Optional dependency. Only
    // listed when the widget is actually enabled by the display-mode setting.
    const widgets = (app as any).widgets;
    if (widgets && showWidget) {
        widgets.add(
            {
                key: 'linkrobins-shoutbox',
                component: { view: () => null },
                placement: 'start_top',
                isUnique: true,
                isDisabled: false,
            },
            'linkrobins-shoutbox'
        );
    }

    app.registry
        .for('linkrobins-shoutbox')
        .registerSetting({
            setting: 'linkrobins-shoutbox.display_mode',
            type: 'select',
            options: {
                both: app.translator.trans('linkrobins-shoutbox.admin.settings.display_mode_both'),
                widget: app.translator.trans('linkrobins-shoutbox.admin.settings.display_mode_widget'),
                page: app.translator.trans('linkrobins-shoutbox.admin.settings.display_mode_page'),
            },
            default: 'both',
            label: app.translator.trans('linkrobins-shoutbox.admin.settings.display_mode_label'),
            help: app.translator.trans('linkrobins-shoutbox.admin.settings.display_mode_help'),
        })
        .registerSetting({
            setting: 'linkrobins-shoutbox.height',
            type: 'number',
            min: 100,
            max: 1000,
            label: app.translator.trans('linkrobins-shoutbox.admin.settings.height_label'),
            help: app.translator.trans('linkrobins-shoutbox.admin.settings.height_help'),
        })
        .registerPermission(
            {
                icon: 'fas fa-bullhorn',
                label: app.translator.trans('linkrobins-shoutbox.admin.permissions.shout'),
                permission: 'linkrobins-shoutbox.shout',
            },
            'start',
            95
        )
        .registerPermission(
            {
                icon: 'fas fa-trash',
                label: app.translator.trans('linkrobins-shoutbox.admin.permissions.moderate'),
                permission: 'linkrobins-shoutbox.moderate',
            },
            'moderate',
            95
        );
});
