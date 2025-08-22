class MonitorHttpCard extends HTMLElement {
    setConfig(config) {
        this.config = config;
        this.innerHTML = '';
    }

    set hass(hass) {
        const cfg = this.config;
        const historyLength = cfg.history_length || 24; // default 24h
        const cardName = cfg.name || 'Monitor HTTP';

        // Multi-entity mode
        if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
            let rows = '';
            for (const row of cfg.entities) {
                const entityId = row.entity;
                const customName = row.name;
                const entity = hass.states[entityId];
                let bars = '';
                let label = customName || (entity ? (entity.attributes.friendly_name || entity.entity_id) : entityId);
                if (!entity) {
                    bars = `<span style="color:#f00;font-size:12px;">Entity not found: ${entityId}</span>`;
                } else {
                    let history = entity.attributes.history || [];
                    if (history.length > historyLength) {
                        history = history.slice(history.length - historyLength);
                    }
                    bars = history.map(([ts, up]) =>
                        `<div style="display:inline-block;width:4px;height:18px;margin-right:1px;background:${up ? '#4caf50' : '#e53935'};border-radius:2px;"></div>`
                    ).join('');
                }
                rows += `
                    <div style="display:flex;align-items:center;margin-bottom:6px;gap:8px;">
                        <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
                        <div style="display:flex;align-items:end;height:20px;flex:1;min-width:0;">${bars}</div>
                    </div>`;
            }
            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:12px 16px 8px 16px;">
                        ${rows}
                        <div style="margin-top:4px;font-size:11px;color:#888;">Service history (${historyLength}h per row)</div>
                    </div>
                </ha-card>
            `;
            return;
        }

        // Single-entity fallback
        const entityId = cfg.entity;
        if (!entityId) {
            this.innerHTML = `<ha-card><div style="padding:16px;">No entity configured.</div></ha-card>`;
            return;
        }
        const entity = hass.states[entityId];
        if (!entity) {
            this.innerHTML = `<ha-card><div style="padding:16px;">Entity not found: ${entityId}</div></ha-card>`;
            return;
        }
        let history = entity.attributes.history || [];
        if (history.length > historyLength) {
            history = history.slice(history.length - historyLength);
        }
        const bars = history.map(([ts, up]) =>
            `<div style="display:inline-block;width:4px;height:18px;margin-right:1px;background:${up ? '#4caf50' : '#e53935'};border-radius:2px;"></div>`
        ).join('');
        this.innerHTML = `
            <ha-card header="${cardName}">
                <div style="padding:16px;">
                    <div style="display:flex;align-items:end;height:32px;">${bars}</div>
                    <div style="margin-top:8px;font-size:12px;color:#888;">Service history (${historyLength}h)</div>
                </div>
            </ha-card>
        `;
    }

    getCardSize() {
        if (this.config && Array.isArray(this.config.entities)) {
            return this.config.entities.length + 1;
        }
        return 2;
    }
}

if (!customElements.get('monitor-http-card')) {
    customElements.define('monitor-http-card', MonitorHttpCard);
}
