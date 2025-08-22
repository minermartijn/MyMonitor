class MonitorHttpCard extends HTMLElement {
	setConfig(config) {
		this.config = config;
		this.innerHTML = '';
	}

	set hass(hass) {
		const entity = hass.states[this.config.entity];
		if (!entity) {
			this.innerHTML = `<ha-card><div style="padding:16px;">Entity not found: ${this.config.entity}</div></ha-card>`;
			return;
		}
		const history = entity.attributes.history || [];
		const bars = history.map(([ts, up]) =>
			`<div style="display:inline-block;width:2px;height:24px;margin-right:1px;background:${up ? 'green' : 'red'}"></div>`
		).join('');
		this.innerHTML = `
			<ha-card header="${entity.attributes.friendly_name || entity.entity_id}">
				<div style="padding:16px;">
					<div style="display:flex;align-items:end;height:32px;">${bars}</div>
					<div style="margin-top:8px;font-size:12px;color:#888;">Service history (last 24h)</div>
				</div>
			</ha-card>
		`;
	}

	getCardSize() {
		return 2;
	}
}
customElements.define('monitor-http-card', MonitorHttpCard);
