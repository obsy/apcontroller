'use strict';
'require dom';
'require form';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

let callHostHints, callAPControllerActivity, callAPControllerScripts, callAPController;
const additionalScriptFile = '/usr/share/apcontroller/apcontroller.user';
let additionalScript = '';

callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

callAPControllerActivity = rpc.declare({
	object: 'apcontroller',
	method: 'activity',
	params: [ 'section' ],
	expect: { '': {} }
});

callAPControllerScripts = rpc.declare({
	object: 'apcontroller',
	method: 'scripts',
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

function hostStatus(records, section_id) {
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

function hostInfo(key, records, section_id) {
	const obj = records.find(item => item.section === section_id);
	const data = obj ? (obj[key] ? obj[key] : '-') : '-';
	return E('span', data);
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			callAPController(),
			L.resolveDefault(fs.read_direct(additionalScriptFile), ""),
			uci.load('apcontroller')
		]);
	},

	handleSaveApply: function(ev, mode) {
		let value = ((document.querySelector('#apcontrolleradditionalscript').value || '').trim().replace(/\r\n/g, '\n')) + '\n';
		fs.write(additionalScriptFile, value)
			.then(function () {
				additionalScript = value;
				document.querySelector('#apcontrolleradditionalscript').value = additionalScript;
				document.body.scrollTop = document.documentElement.scrollTop = 0;
			}).catch(function (e) {
				document.body.scrollTop = document.documentElement.scrollTop = 0;
				ui.addNotification(null, E('p', (_('Unable to save additional script') + ': %s').format(e.message)), 'error');
			});

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
					if (!crontabsroot.endsWith('\n'))
						crontabsroot += '\n';
					crontabsroot += wanted + '\n';
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
		let clients = [];
		updateDeviceStatus(data[1]);
		additionalScript = data[2];

		const devicesmorecolumns = {
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

		const clientscolumns = {
			'ap': _('Connected to'),
			'ssid': _('Connected to SSID'),
			'name': _('Name'),
			'mac': _('MAC Address'),
			'ipaddr': _('IP Address'),
			'band':	_('Band'),
			'wifi': _('Std'),
			'signal': _('Signal'),
			'connected': _('Connected'),
			'rx': _('RX'),
			'tx': _('TX')
		};

		function updateDeviceStatus(records) {
			devicestatus = records;
			clients.length = 0;
			(devicestatus.hosts).forEach(row => {
				const ap = uci.get('apcontroller', row['section'], 'name');

				if (row['mac'])
					row['mac'] = row['mac'].toUpperCase();

				if (row['channels2g'])
					row['channels2g'] = row['channels2g'].replaceAll(' ', ', ')
				if (row['channels5g'])
					row['channels5g'] = row['channels5g'].replaceAll(' ', ', ')
				if (row['channels6g'])
					row['channels6g'] = row['channels6g'].replaceAll(' ', ', ')

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

				if (row['uptime']) {
					row['.uptime'] = row['uptime'];
					row['uptime'] = '%t'.format(row['.uptime']);
				} else
					row['uptime'] = '-';

				if (row['clientslist2g']) {
					row['clients2g'] = String(row['clientslist2g'].length);
					let t = row['clientslist2g'].map(obj => ({
						...obj,
						ap: ap,
						band: 2
					}));
					clients = clients.concat(t);
				}
				if (row['clientslist5g']) {
					row['clients5g'] = String(row['clientslist5g'].length);
					let t = row['clientslist5g'].map(obj => ({
						...obj,
						ap: ap,
						band: 5
					}));
					clients = clients.concat(t);
				}
				if (row['clientslist6g']) {
					row['clients6g'] = String(row['clientslist6g'].length);
					let t = row['clientslist6g'].map(obj => ({
						...obj,
						ap: ap,
						band: 6
					}));
					clients = clients.concat(t);
				}
			})
			clients.forEach(c => {
				const mac = c.mac.toUpperCase();
				c.mac = mac;
				if (c.name == '' || c.name == '*') {
					if (hosts[mac] && hosts[mac].name)
						c.name = (hosts[mac].name).replace('.lan', '');
				}
				if (c.ipaddr == '') {
					if (hosts[mac] && hosts[mac].ipaddrs)
						c.ipaddr = (hosts[mac].ipaddrs).join('<br>');
				}
			});

			// Refresh clients table
			const tablediv = document.querySelector('#clients-container');
			if (tablediv) {
				let table = tablediv.querySelector('table');
				if (table) {
					let t = L.dom.findClassInstance(table);
					let sort = null;
					if (typeof t.getActiveSortState === 'function')
						sort = t.getActiveSortState();
					tablediv.innerHTML = '';
					tablediv.appendChild(renderClientsTable(clients));
					if (sort !== null) {
						table = tablediv.querySelector('table');
						if (table) {
							t = L.dom.findClassInstance(table);
							if (typeof t.setActiveSortState === 'function') {
								t.setActiveSortState(sort[0], sort[1]);
								t.update(t.data, t.placeholder);
							}
						}
					}
				}
			}
		}

		function renderClientsTable(clients) {
			if (!clients || clients.length === 0)
				return E('table', { 'class': 'table table-striped cbi-section-table' }, [
						E('tr', { 'class': 'tr cbi-section-table-row placeholder' }, [
							E('td', { 'class': 'td' }, E('em', _('No wireless clients connected')))
						])
					]);

			const selectedclientscolumns = uci.get('apcontroller', '@global[0]', 'clientcolumn') || [];
			let displayColumns = selectedclientscolumns.length > 0 ? selectedclientscolumns : Object.keys(clientscolumns);

			let headerRow = E('tr', { 'class': 'tr table-titles' },
				displayColumns.map(key =>
					E('th', { 'class': 'th' }, [ clientscolumns[key] ])
				)
			);
			let table = E('table', { 'class': 'table table-striped' }, [ headerRow ]);

			function formatCell(key, client) {
				switch (key) {
					case 'band':
						if (client.band == 2) return '2.4 GHz';
						if (client.band == 5) return '5 GHz';
						if (client.band == 6) return '6 GHz';
						return '-';
					case 'wifi':
						return client.wifi > 0 ? 'Wi-Fi ' + client.wifi : '-';
					case 'signal':
						return (client.signal != null) ? client.signal + ' dBm' : '-';
					case 'connected':
						return [ client.connected, '%t'.format(client.connected) || '-' ];
					case 'rx':
						return [ client.rx, '%1024.2mB'.format(client.rx) || '-' ];
					case 'tx':
						return [ client.tx, '%1024.2mB'.format(client.tx) || '-' ];
					default:
						return client[key] || '-';
				}
			}

			let rows = clients.map(client =>
				displayColumns.map(key => formatCell(key, client))
			);

			cbi_update_table(table, rows);

			return E('div', [ E('h3', _('Connected Wireless Clients')), table ]);
		}

		function refreshDeviceGrid() {

			let devicesall = 0;
			let devicesonline = 0;
			let devicesoffline = 0;
			document.querySelectorAll('#cbi-apcontroller-host tr[data-section-id]').forEach(row => {
				const section_id = row.dataset.sectionId;
				const hostRecord = devicestatus.hosts.find(h => h.section === section_id);

				row.querySelectorAll('li[data-state="disabled"]').forEach(e => {
					if (typeof hostRecord === 'undefined' || !hostRecord || hostRecord['.lastcontact'] == -1) {
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

				Object.entries(devicesmorecolumns).forEach(([key, value]) => {
					if (selectedcolumns.includes(key) || key == 'status') {
						const cell = row.querySelector('[data-name="_' + key + '"]');
						if (!cell) return;

						cell.innerHTML = '';
						if (key == 'status') {
							let status = hostStatus([hostRecord], section_id)
							if (status.textContent.includes(_('Online'))) devicesonline++;
							if (status.textContent.includes(_('Offline'))) devicesoffline++;
							cell.appendChild(status);
						} else
							cell.appendChild(hostInfo(key, [hostRecord], section_id));
					}
				});
				devicesall ++;
			});
			let e = document.querySelector('#devicesall');
			if (e) e.textContent = devicesall;
			e = document.querySelector('#devicesonline');
			if (e) e.textContent = devicesonline;
			e = document.querySelector('#devicesoffline');
			if (e) e.textContent = devicesoffline;
			e = document.querySelector('#devicesunknown');
			if (e) e.textContent = devicesall - devicesonline - devicesoffline;
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

				let devicesall = 0;
				let devicesonline = 0;
				let devicesoffline = 0;
				nodes.querySelectorAll('#cbi-apcontroller-host tr[data-section-id]').forEach(row => {
					const cell = row.querySelector('td[data-name="_status"]');
					if (cell) {
						if (cell.textContent.includes(_('Online'))) devicesonline ++;
						if (cell.textContent.includes(_('Offline'))) devicesoffline ++;
					}
					devicesall ++;
				});

				const css = 'flex: 1 1 25%;background: var(--border-color-low);border: 1.5px solid var(--border-color-medium); box-sizing: border-box;display: flex;flex-direction: column;justify-content: center;align-items: center;text-align: center;padding: 15px 0;border-radius: 8px;';
				const info = E('div', { 'style': 'display: flex; margin-bottom: 20px; gap: 5px;' }, [
					E('div', { 'style': css }, [
						_('All'),
						E('br'),
						E('br'),
						E('span', { 'id': 'devicesall', 'style': 'font-size:1.5em;' }, devicesall)
					]),
					E('div', { 'style': css + 'color: green;' }, [
						_('Online'),
						E('br'),
						E('br'),
						E('span', { 'id': 'devicesonline', 'style': 'font-size:1.5em;' }, devicesonline)
					]),
					E('div', { 'style': css + 'color: red;' }, [
						_('Offline'),
						E('br'),
						E('br'),
						E('span', { 'id': 'devicesoffline', 'style': 'font-size:1.5em;' }, devicesoffline)
					]),
					E('div', { 'style': css + 'color: gray;' }, [
						_('Unknown'),
						E('br'),
						E('br'),
						E('span', { 'id': 'devicesunknown', 'style': 'font-size:1.5em;' }, devicesall - devicesonline - devicesoffline)
					])
				]);
				let e = nodes.querySelector('#cbi-apcontroller-host > h3');
				if (e) e.parentNode.replaceChild(info, e);

				let clientsContainer = E('div', { id: 'clients-container', style: 'margin-top: 20px;' });
				clientsContainer.appendChild(renderClientsTable(clients));
				nodes.appendChild(clientsContainer);

				return nodes;
			});
		};

		s.renderRowActions = function(section_id) {
			const host = devicestatus.hosts.find(item => item.section === section_id);
			let tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]);

			const actionBtn = new ui.ComboButton('more', {
				'more': [ _('More') ],
				'activity': [ _('Activity') ],
				'ping': [ '%s %s'.format(_('IPv4'), _('Ping')) ],
				'exec': [ _('Execute') ]
			}, {
				'classes': {
					'more': 'btn cbi-button cbi-button-normal',
					'activity': 'btn cbi-button cbi-button-normal',
					'ping': 'btn cbi-button cbi-button-normal',
					'exec': 'btn cbi-button cbi-button-normal'
				},
				'click': null,
				'sort': false
			}).render();
			actionBtn.querySelector('li[data-value="more"]').setAttribute('data-state', 'disabled');
			actionBtn.querySelector('li[data-value="activity"]').setAttribute('data-state', 'disabled');
			actionBtn.querySelector('li[data-value="exec"]').setAttribute('data-state', 'disabled');

			if (typeof host === 'undefined' || host['.lastcontact'] == -1) {
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
						case 'activity':
							this.actionActivity(section_id, ev);
							break;
						case 'ping':
							this.actionPing(section_id, ev);
							break;
						case 'exec':
							this.actionExec(section_id, ev);
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
				Object.entries(devicesmorecolumns).forEach(([key, value]) => {
					let val = host[key] ? host[key] : '-';
					if (key == 'status')
						val = hostStatus([host], section_id);
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

		s.actionActivity = function(section_id) {
			return L.resolveDefault(callAPControllerActivity(section_id), {}).then(function (res) {
				function formatDate(date) {
					return date.getFullYear() + '-' + lz(date.getMonth() + 1) + '-' + lz(date.getDate());
				}

				const now = new Date();
				const days = [];
				for (let i = 0; i < 14; i++) {
					let d = new Date(now);
					d.setDate(now.getDate() - i);
					days.push(formatDate(d));
				}

				const heatmap = {};
				days.forEach(day => {
					heatmap[day] = {};
					for (let h = 0; h < 24; h++)
						heatmap[day][h] = -1;
				});

				res.activity.forEach(entry => {
					const dt = new Date(entry.timestamp * 1000);
					const day = formatDate(dt);
					const hour = dt.getHours();

					if (heatmap[day] !== undefined) {
						if (entry.value === 0) {
							heatmap[day][hour] = 0;
						} else if (entry.value === 1) {
							if (heatmap[day][hour] !== 0) {
								heatmap[day][hour] = 1;
							}
						}
					}
				});

				let table = [];

				table.push(E('div', { 'style': 'display:flex;align-items: center;justify-content: center;user-select: none;' }, [ '' ]));
				for (let h = 0; h < 24; h++)
					table.push(E('div', { 'style': 'display:flex;align-items: center;justify-content: center;user-select: none;' }, [ h ]));

				days.forEach(day => {
					table.push(E('div', { 'style': 'display:flex;align-items: center;justify-content: center;user-select: none;' }, [ day ]));
					for (let h = 0; h < 24; h++) {

						let css = 'position: absolute;top: 0; left: 0; right: 0; bottom: 0;display: flex;align-items: center;justify-content: center;color: var(--border-color-low);';
						const val = heatmap[day][h];
						if(val === 1) css += 'background-color: #4caf50;color: white;';
						else if(val === 0) css += 'background-color: #e53935; color: white;';

						table.push(
							E('div', { 'style': 'position: relative;width: 14px;background: var(--border-color-low);border-radius: 2px;box-shadow: 0 1px 2px #0001;box-sizing: border-box;' }, [
								E('div', { 'style': css, 'title': day + ': ' + h }, [ ' ' ])
							])
						);
					}
				});

				let child = [];
				child.push(E('div', { 'style': 'display: grid;grid-template-columns: 100px repeat(24, 14px);grid-gap: 4px;margin: 10px;' }, table ));
				child.push(E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-neutral',
								'click': ui.hideModal
							}, _('Dismiss'))
						])
				);
				ui.showModal(_("Activity"), child);
			});
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

		s.actionExec = function(section_id) {
			const row = this.cfgvalue(section_id);

			return callAPControllerScripts().then(function(res) {
				res.scripts.sort((a, b) => a.file.localeCompare(b.file));
				let options = [];
				res.scripts.forEach(s => {
					options.push(E('option', { 'data-warn': s.warn, 'value': s.file }, [ s.description ]));
				});
				ui.showModal(_('Execute script'), [
					E('div', { 'style': 'display:flex; gap:8px; align-items:center;' }, [
						E('select', { 'id': 'actionexecscript', 'style': 'width:100%' }, options),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-primary',
								'click': ui.createHandlerFn(this, async function() {
									document.querySelector('#actionexecstdout').value = '';
									document.querySelector('#actionexecstderr').value = '';
									const e = document.querySelector('#actionexecscript');
									const selectedOption = e.options[e.selectedIndex];
									const script = selectedOption.value;
									const description = selectedOption.text;
									const warn = selectedOption.getAttribute('data-warn');
									if (warn == '1') {
										if (!confirm(_('Are you sure you want to execute the "%s" script?').format(description)))
											return;
									}
									return fs.exec('sshpass', [
										'-p', typeof row['password'] !== 'undefined' ? row['password']: '""',
										'scp',
										'-o', 'StrictHostKeyChecking=no',
										'-P', row['port'],
										'/usr/share/apcontroller/scripts/' + script,
										row['username'] + '@' + row['ipaddr'] + ':/tmp'
									]).then(function(res) {
										return fs.exec('sshpass', [
											'-p', typeof row['password'] !== 'undefined' ? row['password']: '""',
											'ssh',
											'-q',
											'-o', 'StrictHostKeyChecking=no',
											'-p', row['port'],
											row['username'] + '@' + row['ipaddr'],
											'sh',
											'/tmp/' + script
										]).then(function(res) {
											if (res.stdout) document.querySelector('#actionexecstdout').value = res.stdout;
											if (res.stderr) {
												res.stderr = res.stderr.replace(/ssh: Caution, skipping hostkey check for [\d\.]+\n\n/, "");
												if (res.stderr) document.querySelector('#actionexecstderr').value = res.stderr;
											}
										}).catch(function(err) {
											document.querySelector('#actionexecstderr').value = err;
										});
									}).catch(function(err) {
										document.querySelector('#actionexecstderr').value = err;
									});
								})
							}, [ _('Execute') ])
						])
					]),
					E('span', _('Result')),
					E('textarea', {
						'id': 'actionexecstdout',
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 25,
						'style': 'white-space: nowrap'
					}, [ ]),
					E('span', _('Errors')),
					E('textarea', {
						'id': 'actionexecstderr',
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 10,
						'style': 'white-space: nowrap'
					}, [ ]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							'click': ui.hideModal
						}, [ _('Dismiss') ])
					])
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
		o.textvalue = function (section_id) {
			const name = this.map.data.get('apcontroller', section_id, 'name');
			const url = this.map.data.get('apcontroller', section_id, 'url');

			if (url && url.trim() !== '') {
				return E('a', {
				'href': url,
				'target': '_blank',
				'rel': 'noopener noreferrer'
				}, name);
			}
			return name;
		};

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

		Object.entries(devicesmorecolumns).forEach(([key, value]) => {
			if (selectedcolumns.includes(key) || key == 'status') {
				o = s.taboption('host', form.DummyValue, '_' + key, value);
				o.rawhtml = true;
				o.write = function() {};
				o.remove = function() {};
				o.modalonly = false;
				if (key == 'status')
					o.textvalue = hostStatus.bind(o, devicestatus.hosts);
				else
					o.textvalue = hostInfo.bind(o, key, devicestatus.hosts);
			}
		});

		o = s.taboption('host', form.Value, 'url', _('GUI URL'), _('Link to device GUI address'));
		o.modalonly = true;
		o.datatype = 'string';
		o.validate = function (section_id, value) {
			if (value == "") {
				return true;
			}
			if (!value.match(/^(http|https):\/\//)) {
				return _("URL format error, format: http:// or https://");
			}
			return true;
		}


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
		o.default = [ '2g', '5g' ];
		o.textvalue = function (section_id) {
			const cfgvalues = this.map.data.get('apcontroller', section_id, 'band') || [];
			let names = [];
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

		o = s.taboption('wifi', form.Flag, 'hidden', _('Hide SSID'), _('Do not show network name'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('wifi', form.Flag, 'isolate', _('Isolate Clients'), _('Prevents client-to-client communication'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = '0';

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
				return fs.exec('/usr/bin/apcontroller-sendconfig', [ section_id, 'verbose' ]).then(function(res) {
					ui.showModal(_('Sending commands'), [
						res.stdout ? E('pre', [ res.stdout ]) : '',
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

		o = s.taboption('group', form.Flag, 'delete', _('Delete all'), _('Delete all Wi-Fi before setting up new ones'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('group', form.Flag, 'useadditionalscript', _('Use additional script'), _('Use additional script before setting up a Wi-Fi'));
		o.modalonly = true;
		o.rmempty = false;
		o.default = '0';

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

		o = s.option(form.Value, 'path', _('Data directory'), _('Data storage directory'))
		o.rmempty = false;

		o = s.option(form.Value, 'interval', _('Device Reading Interval'), _('[minutes] The period in which devices will be periodically polled'));
		o.datatype = 'and(uinteger,min(1),max(9999))';

		o = s.option(form.MultiValue, 'column', _('Devices List Columns'), _('List of columns to display in the devices list'));
		o.value('enabled', _('Enabled'));
		o.value('name', _('Name'));
		o.value('ipaddr', _('Host Address'));
		Object.entries(devicesmorecolumns).forEach(([key, value]) => {
			if (key != 'status')
				o.value(key, value);
		});

		o = s.option(form.MultiValue, 'clientcolumn', _('Clients List Columns'), _('List of columns to display in the clients list'));
		Object.entries(clientscolumns).forEach(([key, value]) => {
			o.value(key, value);
		});


		// Custom script
		s = m.section(form.NamedSection, 'additionalscript', 'additionalscript', _('Additional script'));
		s.anonymous = true;
		s.addremove = false;
		s.tab('additionalscript', _('Additional script'));
		s.renderContents = function(/* ... */) {
			const renderTask = form.NamedSection.prototype.renderContents.apply(this, arguments);
			return Promise.resolve(renderTask).then(function(nodes) {
				const scripteditor = E('div', { 'class': 'cbi-section cbi-section-descr' }, [
					E('p', _('If "Use additional script" is selected in the AP Group tab, the following content will be treated \
						as a shell script and executed be executed before each defined Wi-Fi is created. \
						You can use the following variables: <b>$_ENABLED</b>, <b>$_SSID</b>, <b>$_BAND</b>, <b>$_NETWORK</b>. \
						These variables will be replaced with the appropriate values from the Wi-Fi. \
						<b>Verify script before saving and using!</b>')),
					E('textarea', {
						'id': 'apcontrolleradditionalscript',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace; margin-top: .4em',
						'spellcheck': 'false',
						'wrap': 'off',
						'rows': 25
					}, [additionalScript != null ? additionalScript : ''])
				]);
				let e = nodes.querySelector('#cbi-apcontroller-additionalscript > h3');
				if (e) e.parentNode.replaceChild(scripteditor, e);
				return nodes;
			});
		};

		o = s.taboption('additionalscript', form.DummyValue, '_script', '');
		o.cfgvalue = function() {
			return;
		};


		// Refresh data on Devices tab
		poll.add(() => {
			return callAPController().then(livestatus => {
				updateDeviceStatus(livestatus);
				refreshDeviceGrid();
			});
		}, 63);

		return m.render();
	},

	addFooter: function() {
		var footer = view.prototype.addFooter.apply(this, arguments);

		var actions = footer.querySelector('.cbi-page-actions');
		if (!actions)
			return footer;

		var refreshBtn = E('button', {
			'class': 'cbi-button',
			'click': ui.createHandlerFn(this, async function() {
				return fs.exec('/usr/bin/apcontroller')
					.then(
						ui.showModal(_('Refresh'), [
							E('p', { 'class': 'spinning' }, [ _('Please wait...') ])
						])
					).then(
						setTimeout(() => {
							ui.hideModal();
							window.location.reload();
						}, 2000)
					)
			})
		}, [ _('Refresh') ]);

		actions.appendChild(refreshBtn);

		return footer;
	}
});
