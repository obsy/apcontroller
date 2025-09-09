'use strict';
'require dom';
'require form';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

let callHostHints, callAPController;

callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

callAPController = rpc.declare({
	object: 'apcontroller',
	method: 'status',
	expect: { '': {} }
});

function nextFreeSid(name, offset) {
	let sid = '' + name + offset;

	while (uci.get('apcontroller', sid))
		sid = '' + name + (++offset);

	return sid;
}

function lz(n) {
	return (n < 10 ? '0' : '') + n;
}

function hoststatus(records, section_id) {
	let lastContact = -1;
	let lastContact_ts = -1;
	const obj = records.find(item => item.section === section_id);
	if (obj) {
		lastContact = obj['.lastcontact'];
		lastContact_ts = obj['lastcontact_ts'];
	}

	if (lastContact == -1)
		return E('span', '-');
	else {
		const timestamp = new Date().getTime() / 1000;
		const interval = uci.get('apcontroller', '@global[0]', 'interval');
		if (!interval)
			return E('span', { 'style': 'color: gray' }, _('Unknown'));
		else
			if (timestamp - lastContact_ts > parseInt(interval) * 2.5 * 60)
				return E('span', { 'style': 'color: red' }, '● ' + _('Offline'));
			else
				return E('span', { 'style': 'color: green' }, '● ' + _('Online'));
	}
}

function hostinfo(key, records, section_id) {
	const obj = records.find(item => item.section === section_id);
	const data = obj ? (obj[key] ? obj[key] : '-') : '-';
	return E('span', data);
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			callAPController(),
			uci.load('apcontroller')
		]);
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(() => {
			const container = document.querySelector('.cbi-value[data-name="interval"]');
			if (!container) return;
			const input = container.querySelector('input');
			if (!input) return;

			const interval = input.value;

			return fs.read('/etc/crontabs/root').then((data) => {
				let crontabsroot = data || '';
				const regLine = /^(\*\/\d+ \* \* \* \* \/usr\/bin\/apcontroller)$/m;
				const wanted = `*/${interval} * * * * /usr/bin/apcontroller`;

				let needUpdate = false;
				if (!regLine.test(crontabsroot)) {
					crontabsroot += '\n' + wanted;
					needUpdate = true;
				} else if (!crontabsroot.includes(wanted)) {
					crontabsroot = crontabsroot.replace(regLine, wanted);
					needUpdate = true;
				}

				if (!needUpdate) return;

				return fs.write('/etc/crontabs/root', crontabsroot)
					.then(() => fs.exec('/etc/init.d/cron', ['reload']))
					.then(() => fs.exec('/usr/bin/apcontroller'));
			});
		});
	},

	render: function(data) {
		const hosts = data[0];
		let devicestatus = {};
		updateDeviceStatus(data[1]);

		const morecolumns = {
			'status': _('Status'),
			'lastcontact': _('Last Contact'),
			'mac': _('MAC Address'),
			'hostname': _('Hostname'),
			'model': _('Model'),
			'software': _('Software'),
			'uptime': _('Uptime'),
			'load': _('Load Average'),
			'clients2g': _('2.4 GHz Clients'),
			'clients5g': _('5 GHz Clients'),
			'clients6g': _('6 GHz Clients'),
			'channels2g': _('2.4 GHz Channel(s)'),
			'channels5g': _('5 GHz Channel(s)'),
			'channels6g': _('6 GHz Channel(s)')
		};

		function updateDeviceStatus(records) {
			devicestatus = records;
			(devicestatus.hosts).forEach(row => {
				if (row['channels2g'])
					row['channels2g'] = row['channels2g'].replaceAll(' ', ', ')
				if (row['channels5g'])
					row['channels5g'] = row['channels5g'].replaceAll(' ', ', ')
				if (row['channels6g'])
					row['channels6g'] = row['channels6g'].replaceAll(' ', ', ')

				if (row['lastcontact']) {
					row['.lastcontact'] = row['lastcontact'];

					if (row['.lastcontact'] > -1) {
						const d = new Date(new Date().getTime() - row['.lastcontact'] * 1000);

						row['lastcontact_ts'] = d.getTime() / 1000;

						let t = '' + d.getFullYear() + '-' + lz(d.getMonth() + 1) + '-' + lz(d.getDate()) + ' ' +
							lz(d.getHours()) + ':' + lz(d.getMinutes()) + ':' + lz(d.getSeconds());

						if (row['.lastcontact'] > 86400)
							t += ' (' + parseInt(row['.lastcontact']/86400) + _('days ago') + ')';
						else if (row['.lastcontact'] > 3600)
							t += ' (' + parseInt(row['.lastcontact']/3600) + _('h ago') + ')';
						else if (row['.lastcontact'] > 60)
							t += ' (' + parseInt(row['.lastcontact']/60) + _('m ago') + ')';
						else
							t += ' (' + row['.lastcontact'] + _('s ago') + ')';

						row['lastcontact'] = t;
					} else
						row['lastcontact'] = '-';
				} else
					row['lastcontact'] = '-';

				if (row['uptime']) {
					row['.uptime'] = row['uptime'];
					row['uptime'] = '%t'.format(row['.uptime']);
				} else
					row['uptime'] = '-';
			})
		};

		function refreshDeviceGrid() {
			document.querySelectorAll('#cbi-apcontroller-host tr[data-section-id]').forEach(row => {
				const section_id = row.dataset.sectionId;
				const hostRecord = devicestatus.hosts.find(h => h.section === section_id);

				row.querySelectorAll('li[data-state="disabled"]').forEach(e => {
					if (typeof hostRecord === 'undefined' || !hostRecord || !hostRecord['.lastcontact'] || hostRecord['.lastcontact'] == -1) {
						e.setAttribute('aria-disabled', 'true');
						e.classList.add('disabled');
						e.style.pointerEvents = 'none';
						e.style.opacity = '0.5';
					} else {
						e.removeAttribute('aria-disabled');
						e.classList.remove('disabled');
						e.style.pointerEvents = '';
						e.style.opacity = '';
					}
				})

				Object.entries(morecolumns).forEach(([key, value]) => {
					if (selectedcolumns.includes(key) || key == 'status') {
						const cell = row.querySelector('[data-name="_' + key + '"]');
						if (!cell) return;

						cell.innerHTML = '';
						if (key == 'status')
							cell.appendChild(hoststatus([hostRecord], section_id));
						else
							cell.appendChild(hostinfo(key, [hostRecord], section_id));
					}
				});
			});
		};

		const selectedcolumns = uci.get('apcontroller', '@global[0]', 'column') || [];

		let m, s, o;
		m = new form.Map('apcontroller', _('AP Controller'), _('Router and AP Management'));
		m.tabbed = true;


		// Devices tab
		s = m.section(form.GridSection, 'host', _('Devices'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.sortable  = false;
		s.addbtntitle = _('Add new device');
		s.tab('host', _('Device'));

		s.renderContents = function(/* ... */) {
			const renderTask = form.GridSection.prototype.renderContents.apply(this, arguments),
			    sections = this.cfgsections();
			return Promise.resolve(renderTask).then(function(nodes) {
				let e = nodes.querySelector('#cbi-apcontroller-host > h3');
				if (e)
					e.remove();
				return nodes;
			});
		};

		s.renderRowActions = function(section_id) {
			const host = devicestatus.hosts.find(item => item.section === section_id);

			let tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]);

			const actionBtn = new ui.ComboButton('more', {
				'more': [ _('More') ],
				'ping': [ '%s %s'.format(_('IPv4'), _('Ping')) ],
				'log': [ _('Log') ],
				'reboot': [ _('Reboot') ]
			}, {
				classes: {
					'more': 'btn cbi-button cbi-button-normal',
					'ping': 'btn cbi-button cbi-button-normal',
					'log': 'btn cbi-button cbi-button-normal',
					'reboot': 'btn cbi-button cbi-button-normal'
				},
				click: null,
				sort: false
			}).render();
			actionBtn.querySelector('li[data-value="more"]').setAttribute('data-state', 'disabled');
			actionBtn.querySelector('li[data-value="log"]').setAttribute('data-state', 'disabled');
			actionBtn.querySelector('li[data-value="reboot"]').setAttribute('data-state', 'disabled');

			if (typeof host === 'undefined' || !host['.lastcontact'] || host['.lastcontact'] == -1) {
				actionBtn.querySelectorAll('li[data-state="disabled"]').forEach(e => {
					e.setAttribute('aria-disabled', 'true');
					e.classList.add('disabled');
					e.style.pointerEvents = 'none';
					e.style.opacity = '0.5';
				})
			}
			actionBtn.querySelectorAll('li[data-value]').forEach(li => {
				li.addEventListener('click', ev => {
					if (li.getAttribute('aria-disabled') === 'true') return;
					switch (li.dataset.value) {
						case 'more':
							this.actionMoreInformation(section_id, ev);
							break;
						case 'ping':
							this.actionPing(section_id, ev);
							break;
						case 'log':
							this.actionLog(section_id, ev);
							break;
						case 'reboot':
							this.actionReboot(section_id, ev);
							break;
					}
					setTimeout(() => {
						const defaultLi = actionBtn.querySelector('li[data-value="more"]');
						if (defaultLi) {
							actionBtn.querySelectorAll('li[data-value]').forEach(e => {
								e.removeAttribute('selected');
								e.removeAttribute('display');
							});
							defaultLi.setAttribute('selected', '');
							defaultLi.setAttribute('display', 0);
						}
					}, 50);
				});
			});
			dom.content(tdEl.lastChild, [
				actionBtn,
				tdEl.lastChild.childNodes[0],
				tdEl.lastChild.childNodes[1]
			]);

			return tdEl;
		};

		s.handleAdd = function(ev) {
			ev?.preventDefault();

			const newSid = nextFreeSid('host', uci.sections('apcontroller', 'host').length);
			this.map.data.add('apcontroller', 'host', newSid);

			return this.map.reset().then(() => {
				const row = document.querySelector('[data-section-id="' + newSid + '"]');
				if (row) {
					const editBtn = row.querySelector('button[title="Edit"], .cbi-button.cbi-button-edit');
					if (editBtn) editBtn.click();
					setTimeout(() => {
						const modal = document.querySelector('.modal');
						if (modal) {
							const dismissBtn = modal.querySelector('.btn, .cbi-button.cbi-button-reset');
							if (dismissBtn) {
								dismissBtn.addEventListener('click', () => {
									this.map.data.remove('apcontroller', newSid);
									callAPController().then(livestatus => {
										updateDeviceStatus(livestatus);
										return this.map.render();
									}).then(() => {
										refreshDeviceGrid();
									});
								}, { once: true });
							}
						}
					}, 50);
				}
			});
		};

		s.actionMoreInformation = function(section_id) {
			const host = devicestatus.hosts.find(item => item.section === section_id);
			const row = this.cfgvalue(section_id);

			let table = E('table', { 'class': 'table' });
			table.append(
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, _("Enabled")),
					E('td', { 'class': 'td' }, row['enabled'] == 1 ? _('Yes') : _('No'))
				])
			);
			table.append(
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, _("Name")),
					E('td', { 'class': 'td' }, row['name'])
				])
			);
			table.append(
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, _("Host Address")),
					E('td', { 'class': 'td' }, row['ipaddr'])
				])
			);

			if (typeof host !== 'undefined') {
				Object.entries(morecolumns).forEach(([key, value]) => {
					let val = host[key] ? host[key] : '-';
					if (key == 'status')
						val = hoststatus([host], section_id);
					if (typeof host[key] !== 'undefined' || key == 'status')
						table.append(
							E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td' }, value),
								E('td', { 'class': 'td' }, val)
							])
						);
				});
			}

			let child = [];
			child.push(table);
			child.push(E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': ui.hideModal
						}, _('Dismiss'))
					])
			);
			ui.showModal(_("More Information"), child);
		};

		s.actionPing = function(section_id) {
			const row = this.cfgvalue(section_id);

			ui.showModal(_('Ping'), [
				E('p', { 'class': 'spinning' }, [ _('Pinging device...') ])
			]);
			return fs.exec('ping', [ '-4', '-c', '5', '-W', '1', row['ipaddr'] ]).then(function(res) {
				ui.showModal(_('Ping'), [
					res.stdout ? E('textarea', {
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 25
					}, [ res.stdout ]) : '',
					res.stderr ? E('textarea', {
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 25
					}, [ res.stderr ]) : '',
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							'click': ui.hideModal
						}, [ _('Dismiss') ])
					])
				]);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, [
					E('p', [ _('Error') + ': ', err ])
				]);
			});
		};

		s.actionLog = function(section_id) {
			const row = this.cfgvalue(section_id);

			ui.showModal(_('Log'), [
				E('p', { 'class': 'spinning' }, [ _('Fetching log...') ])
			]);
			return fs.exec('sshpass', [
				'-p',
				typeof row['password'] !== 'undefined' ? row['password']: '""',
				'ssh',
				'-q',
				'-o',
				'StrictHostKeyChecking=no',
				'-p',
				row['port'],
				row['username'] + '@' + row['ipaddr'],
				'logread',
				'-l',
				'100']).then(function(res) {
				ui.showModal(_('Log from') + ' ' + row['name'] + ' (' + row['ipaddr'] + ')', [
					res.stdout ? E('textarea', {
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 40,
						'style': 'white-space: nowrap',
					}, [ res.stdout ]) : '',
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							'click': ui.hideModal
						}, [ _('Dismiss') ])
					])
				]);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, [
					E('p', [ _('Error') + ': ', err ])
				]);
			});
		};

		s.actionReboot = function(section_id) {
			const row = this.cfgvalue(section_id);

			if (!confirm(_('Are you sure you want to reboot ' + row['name'] + ' (' + row['ipaddr'] + ')' + '?'))) {
				return;
			}
			ui.showModal(_('Reboot'), [
				E('p', { 'class': 'spinning' }, [ _('Requesting reboot...') ])
			]);
			return fs.exec('sshpass', [
				'-p',
				typeof row['password'] !== 'undefined' ? row['password']: '""',
				'ssh',
				'-q',
				'-o',
				'StrictHostKeyChecking=no',
				'-p',
				row['port'],
				row['username'] + '@' + row['ipaddr'],
				'reboot']).then(function(res) {
				ui.showModal(_('Reboot'), [
					E('p', { }, [ _('Requesting reboot...') + ' ' + _('done') ]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							'click': ui.hideModal
						}, [ _('Dismiss') ])
					])
				]);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, [
					E('p', [ _('Error') + ': ', err ])
				]);
			});
		};

		o = s.taboption('host', form.Flag, 'enabled', _('Enabled'), _('When enabled, the device will be polled periodically'));
		o.rmempty = false;
		o.editable = true;
		o.default = '1';
		if (!selectedcolumns.includes('enabled'))
			o.modalonly = true;

		o = s.taboption('host', form.Value, 'name', _('Name'), _('User-readable description'));
		o.rmempty = false;
		if (!selectedcolumns.includes('name'))
			o.modalonly = true;

		o = s.taboption('host', form.Value, 'ipaddr', _('Host Address'), _('Hostname or IP Address'));
		o.rmempty = false;
		o.datatype = 'or(hostname,ip4addr("nomask"))';
		if (!selectedcolumns.includes('ipaddr'))
			o.modalonly = true;

		let ipaddrs = {};

		Object.keys(hosts).forEach(mac => {
			let addrs = L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4);

			for (let i = 0; i < addrs.length; i++)
				ipaddrs[addrs[i]] = hosts[mac].name || mac;
		});

		L.sortedKeys(ipaddrs, null, 'addr').forEach(ipv4 => {
			o.value(ipv4, ipaddrs[ipv4] ? '%s (%s)'.format(ipv4, ipaddrs[ipv4]) : ipv4);
		});

		o = s.taboption('host', form.Value, 'port', _('Port'), _('SSH Port'), _('Default: 22'));
		o.modalonly = true;
		o.default = 22;
		o.datatype = 'port';

		o = s.taboption('host', form.Value, 'username', _('Username'), _('Device Login'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = 'root';

		o = s.taboption('host', form.Value, 'password', _('Password'), _('Device Password'));
		o.modalonly = true;
		o.password = true;

		Object.entries(morecolumns).forEach(([key, value]) => {
			if (selectedcolumns.includes(key) || key == 'status') {
				o = s.taboption('host', form.DummyValue, '_' + key, value);
				o.rawhtml = true;
				o.write = function() {};
				o.remove = function() {};
				o.modalonly = false;
				if (key == 'status')
					o.textvalue = hoststatus.bind(o, devicestatus.hosts);
				else
					o.textvalue = hostinfo.bind(o, key, devicestatus.hosts);
			}
		});


		// Wi-Fi tab
		s = m.section(form.GridSection, 'wifi', _('Wi-Fi'));
		s.addremove = true;
		s.anonymous = true;
		s.addbtntitle = _('Add new Wi-Fi');
		s.nodescriptions = true;
		s.tab('wifi', _('Wi-Fi'));

		s.renderContents = function(/* ... */) {
			const renderTask = form.GridSection.prototype.renderContents.apply(this, arguments),
			    sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				let e = nodes.querySelector('#cbi-apcontroller-wifi > h3')
				if (e)
					e.remove();
				return nodes;
			});
		};

		s.handleAdd = function(ev) {
			ev?.preventDefault();

			const newSid = nextFreeSid('wifi', uci.sections('apcontroller', 'wifi').length);
			this.map.data.add('apcontroller', 'wifi', newSid);

			return this.map.reset().then(() => {
				const row = document.querySelector('[data-section-id="' + newSid + '"]');
				if (row) {
					const editBtn = row.querySelector('button[title="Edit"], .cbi-button.cbi-button-edit');
					if (editBtn) editBtn.click();

					setTimeout(() => {
						const modal = document.querySelector('.modal');
						if (modal) {
							const dismissBtn = modal.querySelector('.btn, .cbi-button.cbi-button-reset');
							if (dismissBtn) {
								dismissBtn.addEventListener('click', () => {
									this.map.data.remove('apcontroller', newSid);
									this.map.reset();
								}, { once: true });
							}
						}
					}, 50);
				}
			});
		};

		o = s.taboption('wifi', form.Value, 'name', _('Name'), _('User-readable description'));
		o.rmempty = false;

		o = s.taboption('wifi', form.Flag, 'enabled', _('Enabled'), _('Default Wi-Fi state'));
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('wifi', form.MultiValue, 'band', _('Wi-Fi Band'));
		o.rmempty = false;
		o.value('2g', '2.4 GHz');
		o.value('5g', '5 GHz');
		o.value('6g', '6 GHz');
		o.default = '2g';
		o.textvalue = function (section_id) {
			var cfgvalues = this.map.data.get('apcontroller', section_id, 'band') || [];
			var names = [];
			cfgvalues.forEach(band => {
				switch (band) {
					case '2g':
						names.push('2.4 GHz');
						break;
					case '5g':
						names.push('5 GHz');
						break;
					case '6g':
						names.push('6 GHz');
						break;
				}
			});
			if (names.length == 0)
				names = cfgvalues;
			return names.join(', ');
		};

		o = s.taboption('wifi', form.Value, 'ssid', _('SSID'), _('The name that the APs are to advertise'));
		o.rmempty = false;

		o = s.taboption('wifi', form.ListValue, 'encryption', _('Encryption'));
		o.modalonly = true;
		o.value('sae', _('WPA3 Pers. (SAE)'));
		o.value('sae-mixed', _('WPA2/WPA3 Pers. (CCMP)'));
		o.value('psk2', _('WPA2 Pers.'));
		o.value('psk2+ccmp', _('WPA2 Pers. (CCMP)'));
		o.value('psk2+tkip', _('WPA2 Pers. (TKIP)'));
		o.value('psk', _('WPA Pers.'));
		o.value('psk+ccmp', _('WPA Pers. (CCMP)'));
		o.value('psk+tkip', _('WPA Pers. (TKIP)'));
		o.value('psk-mixed+ccmp', _('WPA/WPA2 Pers. (CCMP)'));
		o.value('psk-mixed+tkip', _('WPA/WPA2 Pers. (TKIP)'));
		o.value('owe', _('WPA3 OWE (CCMP)'));
		o.value('none', _('none'));
		o.default = 'psk2';

		o = s.taboption('wifi', form.Value, 'key', _('Password'));
		o.modalonly = true;
		o.rmempty = false;
		o.depends({ encryption: 'sae', '!contains': true });
		o.depends({ encryption: 'psk', '!contains': true });
		o.datatype = 'wpakey';
		o.password = true;

		o = s.taboption('wifi', form.Value, 'network', _('Network'), _('The name of the network to which the Wi-Fi will belong'));
		o.modalonly = true;
		o.rmempty = false;
		o.datatype = 'uciname';
		o.validate = function(section_id, value) {
			if (value.length > 15)
				return _('The interface name is too long');
			return true;
		};
		o.default = 'lan';


		// AP Group tab
		s = m.section(form.GridSection, 'group', _('AP Group'));
		s.addremove = true;
		s.anonymous = true;
		s.addbtntitle = _('Add new group');
		s.nodescriptions = true;
		s.tab('group', _('AP Group'));

		s.renderContents = function(/* ... */) {
			const renderTask = form.GridSection.prototype.renderContents.apply(this, arguments),
			    sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				let e = nodes.querySelector('#cbi-apcontroller-group > h3')
				if (e)
					e.remove();
				return nodes;
			});
		};

		s.renderRowActions = function(section_id) {
			let tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]),
				send_opt = {
					'class': 'btn cbi-button cbi-button-neutral',
					'title': _('Send config to devices'),
					'click': ui.createHandlerFn(this, 'handleSendConfig', section_id)
				};

			dom.content(tdEl.lastChild, [
				E('button', send_opt, _('Send')),
				tdEl.lastChild.childNodes[0],
				tdEl.lastChild.childNodes[1]
			]);

			return tdEl;
		};

		s.handleSendConfig = function (section_id, ev) {
			return this.map.save().then(() => {
				ui.showModal(_('Sending commands'), [
					E('p', { 'class': 'spinning' }, [ _('Sending commands to devices...') ])
				]);
				return fs.exec('/usr/bin/apcontroller-sendconfig', [section_id, 'verbose']).then(function(res) {
					ui.showModal(_('Sending commands'), [
						res.stdout ? E('p', [ res.stdout ]) : '',
						res.stderr ? E('pre', [ res.stderr ]) : '',
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-primary',
								'click': ui.hideModal
							}, [ _('Dismiss') ])
						])
					]);
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, [
						E('p', [ _('Error') + ': ', err ])
					]);
				});
			}).catch(err => {
				ui.addNotification(null, E('p', err?.message || err), 'error');
			});
		};

		o = s.taboption('group', form.Value, 'name', _('Name'), _('User-readable description'));
		o.rmempty = false;

		o = s.taboption('group', form.MultiValue, 'host', _('Selected Devices'));

		let any = false;
		uci.sections('apcontroller', 'host', function (s) {
			o.value(s['.name'], s['name'] + ' (' + s['ipaddr'] + ')');
			any = true;
		});
		if (!any) {
			o.value('', '(' + _('no devices found') + ')');
		}
		o.textvalue = function (section_id) {
			const cfgvalues = this.map.data.get('apcontroller', section_id, 'host') || [];
			let t;
			let names = [];
			cfgvalues.forEach(sec => {
				t = this.map.data.get('apcontroller', sec, 'name');
				if (t)
					names.push(t);
			});
			if (names.length == 0)
				names = cfgvalues;
			return names.join(', ');
		};

		any = false;
		o = s.taboption('group', form.MultiValue, 'wifi', _('Selected Wi-Fi'));
		uci.sections('apcontroller', 'wifi', function (s) {
			o.value(s['.name'], s['name']);
			any = true;
		});
		if (!any) {
			o.value('', '(' + _('no Wi-Fi found') + ')');
		}
		o.textvalue = function (section_id) {
			const cfgvalues = this.map.data.get('apcontroller', section_id, 'wifi') || [];
			let t;
			let names = [];
			cfgvalues.forEach(sec => {
				t = this.map.data.get('apcontroller', sec, 'name');
				if (t)
					names.push(t);
			});
			if (names.length == 0)
				names = cfgvalues;
			return names.join(', ');
		};


		// Settings tab
		s = m.section(form.TypedSection, 'global', _('Settings'));
		s.anonymous = true;

		s.renderContents = function(/* ... */) {
			const renderTask = form.TypedSection.prototype.renderContents.apply(this, arguments),
			    sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				let e = nodes.querySelector('#cbi-apcontroller-global > h3')
				if (e)
					e.remove();
				return nodes;
			});
		};

		o = s.option(form.Value, 'interval', _('Device Reading Interval'), _('[minutes] The period in which devices will be periodically polled'));
		o.datatype = 'and(uinteger,min(1),max(9999))';

		o = s.option(form.MultiValue, 'column', _('Displayed Column List'), _('List of columns to display in the devices list'));
		o.value('enabled', _('Enabled'));
		o.value('name', _('Name'));
		o.value('ipaddr', _('Host Address'));
		Object.entries(morecolumns).forEach(([key, value]) => {
			if (key != 'status')
				o.value(key, value);
		});

		// Refresh data on Devices tab
		poll.add(() => {
			return callAPController().then(livestatus => {
				updateDeviceStatus(livestatus);
				refreshDeviceGrid();
			});
		}, 63);

		return m.render();
	}
});
