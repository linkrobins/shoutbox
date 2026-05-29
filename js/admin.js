'use strict';

(function () {

    app.initializers.add('linkrobins/shoutbox', function () {

        if (app.widgets) {
            app.widgets.add({
                key:        'linkrobins-shoutbox',
                component:  { view: function () { return null; } },
                placement:  'start_top',
                isUnique:   true,
                isDisabled: false,
            }, 'linkrobins-shoutbox');
        }

        app.registry
            .for('linkrobins-shoutbox')
            .registerSetting({
                setting:  'linkrobins-shoutbox.height',
                type:     'number',
                min:      100,
                max:      1000,
                label:    app.translator.trans('linkrobins-shoutbox.admin.settings.height_label'),
                help:     app.translator.trans('linkrobins-shoutbox.admin.settings.height_help'),
            })
            .registerPermission({
                icon:       'fas fa-bullhorn',
                label:      app.translator.trans('linkrobins-shoutbox.admin.permissions.shout'),
                permission: 'linkrobins-shoutbox.shout',
            }, 'start', 95)
            .registerPermission({
                icon:       'fas fa-trash',
                label:      app.translator.trans('linkrobins-shoutbox.admin.permissions.moderate'),
                permission: 'linkrobins-shoutbox.moderate',
            }, 'moderate', 95);

    });

})();
