"""Sensor platform for MyMonitor."""

from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.config_entries import ConfigEntryNotReady
from .coordinator import MonitorHttpCoordinator
from .const import DOMAIN, CONF_NAME, CONF_URL, CONF_METHOD, CONF_EXPECTED, DEFAULT_METHOD, DEFAULT_EXPECTED
import aiohttp


async def async_setup_entry(hass, entry, async_add_entities):
	data = entry.data
	coordinator = MonitorHttpCoordinator(
		hass,
		name=data[CONF_NAME],
		url=data[CONF_URL],
		method=data.get(CONF_METHOD, DEFAULT_METHOD),
		expected=data.get(CONF_EXPECTED, DEFAULT_EXPECTED),
		interval=60,
	)
	try:
		await coordinator.async_config_entry_first_refresh()
	except (aiohttp.ClientError, Exception) as err:
		# Raise ConfigEntryNotReady so HA can retry later
		raise ConfigEntryNotReady(f"Could not connect to endpoint: {err}")
	async_add_entities([MonitorHttpSensor(coordinator, data[CONF_NAME])])

class MonitorHttpSensor(CoordinatorEntity, SensorEntity):
	def __init__(self, coordinator, name):
		super().__init__(coordinator)
		self._attr_name = name
		# Use both name and URL for uniqueness
		url_part = coordinator.url.replace('://', '_').replace('/', '_')
	self._attr_unique_id = f"mymonitor_{name}_{url_part}"

	@property
	def state(self):
		return "on" if self.coordinator.data else "off"

	@property
	def extra_state_attributes(self):
		# Expose history for the frontend card
		return {"history": self.coordinator.history}
