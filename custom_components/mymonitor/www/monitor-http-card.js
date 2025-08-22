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
            // Check cache expiry (refresh every 2 minutes for better debugging)
            const now = Date.now();
            if (this._lastUpdate[entityId] && (now - this._lastUpdate[entityId]) < 2 * 60 * 1000) {
                console.log(`Using cached data for ${entityId}`);
                return this._historyCache[entityId] || [];
            }

            console.log(`Fetching history for ${entityId} over ${hours} hours`);

            // Fetch history from Home Assistant API
            const start = new Date(now - hours * 60 * 60 * 1000);
            const startIso = start.toISOString();
            
            // More robust URL construction
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/api/history/period/${startIso}?filter_entity_id=${entityId}&minimal_response&no_attributes`;
            
            console.log(`Fetching from URL: ${url}`);
            
            const resp = await fetch(url, { 
                credentials: 'same-origin',
                headers: {
                    'Authorization': `Bearer ${this._getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!resp.ok) {
                console.error(`Failed to fetch history for ${entityId}: ${resp.status} ${resp.statusText}`);
                const errorText = await resp.text();
                console.error('Response body:', errorText);
                return [];
            }

            const data = await resp.json();
            console.log(`Raw history data for ${entityId}:`, data);

            if (!Array.isArray(data) || data.length === 0) {
                console.warn(`No history data returned for ${entityId}`);
                return [];
            }

            const entityData = data[0];
            if (!entityData || entityData.length === 0) {
                console.warn(`Empty history array for ${entityId}`);
                return [];
            }

            // Map to [timestamp, up] where up = true for 'on' or 'online', false for 'off' or 'offline'
            const history = entityData.map(entry => {
                const isUp = entry.state === 'on' || entry.state === 'online' || 
                           entry.state === 'true' || entry.state === '1' || 
                           entry.state === 'available' || entry.state === 'connected';
                return [entry.last_changed, isUp];
            });

            console.log(`Processed ${history.length} history entries for ${entityId}`);

            // Cache the result
            this._historyCache[entityId] = history;
            this._lastUpdate[entityId] = now;

            return history;
        } catch (error) {
            console.error(`Error fetching history for ${entityId}:`, error);
            return [];
        }
    }

    async checkRecorderStatus(hass) {
        try {
            const resp = await fetch('/api/config', { credentials: 'same-origin' });
            if (resp.ok) {
                const config = await resp.json();
                return {
                    enabled: config.components.includes('recorder'),
                    dbSize: 'Available'
                };
            }
        } catch (e) {
            console.warn('Could not check recorder status:', e);
        }
        return { enabled: false, dbSize: 'Unknown' };
    }

    _getAuthToken() {
        // Try to get auth token from Home Assistant frontend
        if (window.hassConnection && window.hassConnection.auth && window.hassConnection.auth.accessToken) {
            return window.hassConnection.auth.accessToken;
        }
        // Fallback - this might not be needed if using credentials: 'same-origin'
        return '';
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
        const showDebug = cfg.show_debug || false;

        // Add debug information if requested
        let debugInfo = '';
        if (showDebug) {
            const recorderInfo = await this.checkRecorderStatus(hass);
            debugInfo = `
                <div style="background:#f5f5f5;padding:8px;margin-bottom:12px;font-size:11px;border-radius:4px;">
                    <strong>Debug Info:</strong><br>
                    Recorder: ${recorderInfo.enabled ? 'Enabled' : 'Disabled'}<br>
                    DB Size: ${recorderInfo.dbSize || 'Unknown'}<br>
                    Last Update: ${new Date().toLocaleString()}
                </div>
            `;
        }

        // Multi-entity mode
        if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
            let rows = '';
            
            for (const row of cfg.entities) {
                const entityId = row.entity;
                const customName = row.name;
                const entity = hass.states[entityId];
                let bars = '';
                let status = '';
                let debugText = '';
                let label = customName || (entity ? (entity.attributes.friendly_name || entity.entity_id) : entityId);

                if (!entity) {
                    bars = `<span style="color:#f00;font-size:12px;">Entity not found: ${entityId}</span>`;
                    status = '❌';
                } else {
                    const history = await this.fetchEntityHistory(entityId, historyLength);
                    bars = this.generateHistoryBars(history);
                    
                    // Current status indicator
                    const currentState = entity.state === 'on' || entity.state === 'online' || 
                                       entity.state === 'true' || entity.state === '1' ||
                                       entity.state === 'available' || entity.state === 'connected';
                    status = currentState ? '🟢' : '🔴';

                    if (showDebug) {
                        debugText = `<div style="font-size:10px;color:#666;margin-left:24px;">
                            State: ${entity.state} | History: ${history.length} points | 
                            Last: ${entity.last_changed}
                        </div>`;
                    }
                }

                rows += `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div style="font-size:16px;">${status}</div>
                            <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:120px;">${label}</div>
                            <div style="display:flex;align-items:end;height:20px;flex:1;min-width:0;">${bars}</div>
                        </div>
                        ${debugText}
                    </div>`;
            }

            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:12px 16px 16px 16px;">
                        ${debugInfo}
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
