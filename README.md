# Monitor HTTP/Service

A Home Assistant custom integration (HACS compatible) to monitor HTTP endpoints or services, with a beautiful Lovelace card for service history visualization.

## Features
# MyMonitor
- Add and monitor multiple HTTP endpoints or services
- View service history with green/red bars (up/down) in a custom Lovelace card
- Easy configuration via Home Assistant UI
2. Install the "Monitor HTTP/Service" integration from HACS.
3. Restart Home Assistant if prompted.
4. Add the integration via Home Assistant UI (Settings → Devices & Services → Add Integration → Monitor HTTP/Service).
2. Install the "MyMonitor" integration from HACS.
6. **Frontend card:**
4. Add the integration via Home Assistant UI (Settings → Devices & Services → Add Integration → MyMonitor).

## Manual Installation
1. Download `monitor-http-card.js` from [this repo](https://github.com/yourusername/monitor_http).
2. Place it in your Home Assistant `/config/www/` directory.
3. In Home Assistant, go to Settings → Dashboards → Resources, and add:
	 - URL: `https://raw.githubusercontent.com/minermartijn/MyMonitor/refs/heads/master/custom_components/mymonitor/www/monitor-http-card.js`
	 - Type: JavaScript Module
4. Add the card to your dashboard using:
	 ```yaml
	 type: custom:monitor-http-card
	 name: My Monitors
	 entities:
		 - entity: sensor.phpmyadmin
			 name: PHP My Admin
		 - entity: sensor.radarr_monitor
			 name: Radarr
	 # Optional: history_length: 72 (for 3 days, default is 24)
	 ```
	 Replace the entities and names with your own.

## Usage
### 1. Add the Integration
- Go to Home Assistant Settings → Devices & Services → Add Integration
- Search for "Monitor HTTP/Service"
- Add endpoints to monitor (name, URL, method, expected status)
Search for "MyMonitor"
- Choose "Manual"
- Use the following YAML:
  ```
  Replace `YOUR_MONITOR_NAME` with the name you gave your monitor (lowercase, spaces replaced with underscores)

## Example
```yaml
type: custom:monitor-http-card
entity: sensor.my_website
```

## License
MIT
