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
        console.log('MonitorHttpCard: Config set', config);
    }

    async fetchEntityHistory(entityId, hours) {
        console.log(`=== FETCHING HISTORY FOR ${entityId} ===`);
        
        try {
            const now = Date.now();
            const start = new Date(now - hours * 60 * 60 * 1000);
            const startIso = start.toISOString();
            
            console.log(`Time range: ${start.toLocaleString()} to ${new Date(now).toLocaleString()}`);
            
            // Try multiple URL formats to see which works
            const urls = [
                `/api/history/period/${startIso}?filter_entity_id=${entityId}&minimal_response&no_attributes`,
                `/api/history/period/${startIso}?filter_entity_id=${entityId}&minimal_response`,
                `/api/history/period/${startIso}?filter_entity_id=${entityId}`,
            ];
            
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                console.log(`Trying URL ${i + 1}: ${url}`);
                
                try {
                    const resp = await fetch(url, { 
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`Response ${i + 1}: ${resp.status} ${resp.statusText}`);
                    
                    if (resp.ok) {
                        const data = await resp.json();
                        console.log(`Data ${i + 1}:`, data);
                        
                        if (Array.isArray(data) && data.length > 0 && data[0] && data[0].length > 0) {
                            const history = data[0].map(entry => {
                                const isUp = this._determineUpState(entry.state);
                                console.log(`Entry: ${entry.last_changed} -> ${entry.state} -> ${isUp ? 'UP' : 'DOWN'}`);
                                return [entry.last_changed, isUp];
                            });
                            
                            console.log(`Successfully processed ${history.length} history entries`);
                            return history;
                        } else {
                            console.log(`URL ${i + 1} returned empty or invalid data`);
                        }
                    } else {
                        const errorText = await resp.text();
                        console.error(`URL ${i + 1} failed:`, errorText);
                    }
                } catch (e) {
                    console.error(`URL ${i + 1} error:`, e);
                }
            }
            
            console.log('All history fetch attempts failed');
            return [];
            
        } catch (error) {
            console.error(`Major error fetching history for ${entityId}:`, error);
            return [];
        }
    }

    _determineUpState(state) {
        if (typeof state === 'string') {
            const lowerState = state.toLowerCase();
            const isUp = lowerState === 'on' || 
                        lowerState === 'online' || 
                        lowerState === 'true' || 
                        lowerState === 'connected' || 
                        lowerState === 'available' ||
                        lowerState === 'home' ||
                        lowerState === 'open' ||
                        lowerState === '1';
            return isUp;
        }
        return Boolean(state);
    }

    generateHistoryBars(history, maxBars = 100) {
        console.log(`Generating bars for ${history.length} history entries`);
        
        if (!history || history.length === 0) {
            return '<span style="color:#888;font-size:12px;">No history data found</span>';
        }

        // Sample data if too many points
        let sampledHistory = history;
        if (history.length > maxBars) {
            const step = Math.ceil(history.length / maxBars);
            sampledHistory = history.filter((_, index) => index % step === 0);
            console.log(`Sampled history from ${history.length} to ${sampledHistory.length} points`);
        }

        const bars = sampledHistory.map(([timestamp, up]) => {
            const color = up ? '#4caf50' : '#e53935';
            const title = `${new Date(timestamp).toLocaleString()}: ${up ? 'Online' : 'Offline'}`;
            return `<div style="display:inline-block;width:4px;height:18px;margin-right:1px;background:${color};border-radius:2px;" title="${title}"></div>`;
        }).join('');
        
        return bars;
    }

    async testCurrentEntityState(hass, entityId) {
        console.log(`=== TESTING CURRENT STATE FOR ${entityId} ===`);
        
        // Test 1: Check if entity exists in hass.states
        const entity = hass.states[entityId];
        if (!entity) {
            console.error(`Entity ${entityId} not found in hass.states`);
            console.log('Available entities starting with same prefix:', 
                Object.keys(hass.states).filter(e => e.startsWith(entityId.split('.')[0])));
            return false;
        }
        
        console.log(`Current entity state:`, entity);
        console.log(`State: ${entity.state}, Last changed: ${entity.last_changed}`);
        
        // Test 2: Check if we can fetch current state via API
        try {
            const resp = await fetch(`/api/states/${entityId}`, { 
                credentials: 'same-origin' 
            });
            if (resp.ok) {
                const apiEntity = await resp.json();
                console.log(`API entity state:`, apiEntity);
            } else {
                console.error(`API states fetch failed: ${resp.status}`);
            }
        } catch (e) {
            console.error('API states test failed:', e);
        }
        
        return true;
    }

    async renderCard(hass) {
        console.log('=== RENDERING CARD ===');
        
        if (!this.config) {
            console.error('No config available');
            return;
        }

        const cfg = this.config;
        const historyLength = cfg.history_length || 24;
        const cardName = cfg.name || 'Monitor HTTP';
        const showDebug = cfg.show_debug || false;

        console.log(`Config: ${JSON.stringify(cfg)}`);

        // Multi-entity mode
        if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
            console.log(`Multi-entity mode with ${cfg.entities.length} entities`);
            
            let rows = '';
            
            for (const [index, row] of cfg.entities.entries()) {
                console.log(`\n--- Processing entity ${index + 1}: ${row.entity} ---`);
                
                const entityId = row.entity;
                const customName = row.name;
                
                // Test current state first
                const entityExists = await this.testCurrentEntityState(hass, entityId);
                if (!entityExists) {
                    rows += `
                        <div style="margin-bottom:8px;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <div style="font-size:16px;">❌</div>
                                <div style="font-size:13px;color:#f00;">${entityId} - NOT FOUND</div>
                            </div>
                        </div>`;
                    continue;
                }

                const entity = hass.states[entityId];
                const label = customName || (entity.attributes.friendly_name || entity.entity_id);
                
                // Fetch history
                console.log(`Fetching ${historyLength}h of history...`);
                const history = await this.fetchEntityHistory(entityId, historyLength);
                const bars = this.generateHistoryBars(history);
                
                // Current status
                const currentState = this._determineUpState(entity.state);
                const status = currentState ? '🟢' : '🔴';
                
                let debugText = '';
                if (showDebug) {
                    debugText = `<div style="font-size:10px;color:#666;margin-left:24px;margin-top:4px;">
                        State: "${entity.state}" | History: ${history.length} points | 
                        Last: ${entity.last_changed} | Current: ${currentState ? 'UP' : 'DOWN'}
                    </div>`;
                }

                rows += `
                    <div style="margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div style="font-size:16px;">${status}</div>
                            <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:120px;">${label}</div>
                            <div style="display:flex;align-items:end;height:20px;flex:1;min-width:0;">${bars}</div>
                        </div>
                        ${debugText}
                    </div>`;
            }

            let debugInfo = '';
            if (showDebug) {
                debugInfo = `
                    <div style="background:#f5f5f5;padding:8px;margin-bottom:12px;font-size:11px;border-radius:4px;">
                        <strong>Debug Info:</strong><br>
                        Entities configured: ${cfg.entities.length}<br>
                        History length: ${historyLength}h<br>
                        Last render: ${new Date().toLocaleString()}<br>
                        Check browser console for detailed logs
                    </div>
                `;
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

        // Single entity mode
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

        console.log(`Single entity mode: ${entityId}`);
        
        const entityExists = await this.testCurrentEntityState(hass, entityId);
        if (!entityExists) {
            this.innerHTML = `
                <ha-card header="${cardName}">
                    <div style="padding:16px;color:#f00;">
                        Entity not found: ${entityId}
                    </div>
                </ha-card>`;
            return;
        }

        const entity = hass.states[entityId];
        const history = await this.fetchEntityHistory(entityId, historyLength);
        const bars = this.generateHistoryBars(history);
        const currentState = this._determineUpState(entity.state);
        const status = currentState ? '🟢 Online' : '🔴 Offline';

        this.innerHTML = `
            <ha-card header="${cardName}">
                <div style="padding:16px;">
                    <div style="margin-bottom:12px;font-size:14px;font-weight:500;">
                        ${status} - ${entity.attributes.friendly_name || entity.entity_id}
                    </div>
                    <div style="display:flex;align-items:end;height:32px;margin-bottom:8px;">${bars}</div>
                    <div style="font-size:12px;color:#888;text-align:center;">
                        Service history (${historyLength}h) • ${history.length} data points
                    </div>
                </div>
            </ha-card>
        `;
    }

    set hass(hass) {
        if (!hass) {
            console.log('Hass not available yet');
            return;
        }
        console.log('Hass received, rendering card...');
        this.renderCard(hass);
    }

    getCardSize() {
        if (this.config && Array.isArray(this.config.entities)) {
            return Math.max(2, this.config.entities.length + 1);
        }
        return 2;
    }

    static getStubConfig() {
        return {
            name: 'Monitor HTTP',
            entities: [
                { entity: 'binary_sensor.example_service', name: 'Example Service' }
            ],
            history_length: 24,
            show_debug: true
        };
    }
}

// Register the card
console.log('Registering MonitorHttpCard...');
if (!customElements.get('monitor-http-card')) {
    customElements.define('monitor-http-card', MonitorHttpCard);
    console.log('MonitorHttpCard registered successfully');
} else {
    console.log('MonitorHttpCard already registered');
}

// Add the card to the custom card picker
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'monitor-http-card',
    name: 'Monitor HTTP Card',
    description: 'A card to monitor HTTP service uptime with history visualization'
});

console.log('MonitorHttpCard script loaded completely');
