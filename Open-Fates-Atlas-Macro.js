const atlas = game.modules.get('telys-fates-atlas');
if (!atlas?.active || !atlas.api) ui.notifications.warn('Enable Tely’s Fate’s Atlas first.');
else atlas.api.open();
