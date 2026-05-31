import app from 'flarum/admin/app';

app.initializers.add('linkrobins/shoutbox', () => {
    // Register a no-op widget entry so fof/forum-widgets-core lists it (the
    // real widget lives in the forum frontend). Optional dependency.
    const widgets = (app as any).widgets;
    if (widgets) {
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
