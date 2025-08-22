class MonitorHttpCard extends HTMLElement {
    constructor() {
        super();
        this._historyCache = {};
        this._lastUpdate = {};
    }

    setConfig(config) {
        if (!config) {
            throw new Error('Invalid configuration');
        }
        this.config = config;
        this.innerHTML = '';
        this._historyCache = {};
        this._lastUpdate = {};
    }

    async fetchEntityHistory(entityId, hours) {
        try {
            // Check cache expiry (refresh every 5 minutes)
            const now = Date.now();
            if (this._lastUpdate[entityId] && (now - this._lastUpdate[entityId]) < 5 * 60 * 1000) {
                return this._historyCache[entityId] || [];
            }

            // Fetch history from Home Assistant API
            const start = new Date(now - hours * 60 * 60 * 1000);
            const startIso = start.toISOString();
            const url = `/api/history/period/${startIso}?filter_entity_id=${entityId}&minimal_response&no_attributes`;
            
            const resp = await fetch(url, { credentials: 'same-origin' });
            if (!resp.ok) {
                console.error(`Failed to fetch history for ${entityId}: ${resp.status}`);
                return [];
            }

            const data = await resp.json();
            if (!Array.isArray(data) || !data[0]) {
                return [];
            }

            // Map to [timestamp, up] where up = true for 'on' or 'online', false for 'off' or 'offline'
            const history = data[0].map(entry => [
                entry.last_changed, 
                entry.state === 'on' || entry.state === 'online' || entry.state === 'true'
            ]);

            // Cache the result
            this._historyCache[entityId] = history;
            this._lastUpdate[entityId] = now;

            return history;
        } catch (error) {
            console.error(`Error fetching history for ${entityId}:`, error);
            return [];
        }
    }

    generateHistoryBars(history, maxBars = 100) {
        if (!history || history.length === 0) {
            return '<span style="color:#888;font-size:12px;">No data</span>';
        }

        // If we have too many data points, sample them
        let sampledHistory = history;
        if (history.length > maxBars) {
            const step = Math.floor(history.length / maxBars);
            sampledHistory = history.filter((_, index) => index % step === 0);
        }

        return sampledHistory.map(([timestamp, up]) => {
            const color = up ? '#4caf50' : '#e53935';
            const title = `${new Date(timestamp).toLocaleString()}: ${up ? 'Online' : 'Offline'}`;
            return `<div style="display:inline-block;width:4px;height:18px;margin-right:1px;background:${color};border-radius:2px;" title="${title}"></div>`;
        }).join('');
    }

    async renderCard(hass) {
        if (!this.config) return;

        const cfg = this.config;
        const historyLength = cfg.history_length || 24;
        const cardName = cfg.name || 'Monitor HTTP';

        // Multi-entity mode
        if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
            let rows = '';
            
            for (const row of cfg.entities) {
                const entityId = row.entity;
                const customName = row.name;
                const entity = hass.states[entityId];
                let bars = '';
                let status = '';
                let label = customName || (entity ? (entity.attributes.friendly_name || entity.entity_id) : entityId);

                if (!entity) {
                    bars = `<span style="color:#f00;font-size:12px;">Entity not found: ${entityId}</span>`;
                    status = '❌';
                } else {
                    const history = await this.fetchEntityHistory(entityId, historyLength);
                    bars = this.generateHistoryBars(history);
                    
                    // Current status indicator
                    const currentState = entity.state === 'on' || entity.state === 'online' || entity.state === 'true';
                    status = currentState ? '🟢' : '🔴';
                }

                rows += `
                    <div style="display:flex;align-items:center;margin-bottom:8px;gap:8px;">
                        <div style="font-size:16px;">${status}</div>
                        <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:120px;">${label}</div>
                        <div style="display:flex;align-items:end;height:20px;flex:1;min-width:0;">${bars}</div>
                    </div>`;
            }

            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:12px 16px 16px 16px;">
                        ${rows}
                        <div style="margin-top:8px;font-size:11px;color:#888;text-align:center;">
                            Service history (${historyLength}h per row) • 🟢 Online • 🔴 Offline
                        </div>
                    </div>
                </ha-card>
            `;
            return;
        }

        // Single-entity mode
        const entityId = cfg.entity;
        if (!entityId) {
            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:16px;color:#f00;">
                        No entity configured. Please add an 'entity' or 'entities' to your configuration.
                    </div>
                </ha-card>`;
            return;
        }

        const entity = hass.states[entityId];
        if (!entity) {
            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:16px;color:#f00;">
                        Entity not found: ${entityId}
                    </div>
                </ha-card>`;
            return;
        }

        const history = await this.fetchEntityHistory(entityId, historyLength);
        const bars = this.generateHistoryBars(history);
        const currentState = entity.state === 'on' || entity.state === 'online' || entity.state === 'true';
        const status = currentState ? '🟢 Online' : '🔴 Offline';

        this.innerHTML = `
            <ha-card header="${cardName}">
                <div style="padding:16px;">
                    <div style="margin-bottom:12px;font-size:14px;font-weight:500;">
                        ${status} - ${entity.attributes.friendly_name || entity.entity_id}
                    </div>
                    <div style="display:flex;align-items:end;height:32px;margin-bottom:8px;">${bars}</div>
                    <div style="font-size:12px;color:#888;text-align:center;">
                        Service history (${historyLength}h) • Hover bars for timestamps
                    </div>
                </div>
            </ha-card>
        `;
    }

    set hass(hass) {
        if (!hass) return;
        this.renderCard(hass);
    }

    getCardSize() {
        if (this.config && Array.isArray(this.config.entities)) {
            return Math.max(2, this.config.entities.length + 1);
        }
        return 2;
    }

    static getConfigElement() {
        return document.createElement('monitor-http-card-editor');
    }

    static getStubConfig() {
        return {
            name: 'Monitor HTTP',
            entities: [
                { entity: 'binary_sensor.example_service', name: 'Example Service' }
            ],
            history_length: 24
        };
    }
}

// Register the card
if (!customElements.get('monitor-http-card')) {
    customElements.define('monitor-http-card', MonitorHttpCard);
    console.info('Monitor HTTP Card registered');
}

// Add the card to the custom card picker
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'monitor-http-card',
    name: 'Monitor HTTP Card',
    description: 'A card to monitor HTTP service uptime with history visualization'
});
