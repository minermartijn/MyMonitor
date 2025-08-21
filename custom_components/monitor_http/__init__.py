


"""MyMonitor Integration for Home Assistant."""
from .const import DOMAIN





PLATFORMS = ["sensor"]

async def async_setup_entry(hass, entry):
	"""Set up MyMonitor from a config entry."""
	if hasattr(entry, "async_setup_platforms"):
		await entry.async_setup_platforms(PLATFORMS)
	elif hasattr(hass.config_entries, "async_forward_entry_setups"):
		await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
	else:
		for platform in PLATFORMS:
			hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, platform))
	return True


async def async_unload_entry(hass, entry):
	if hasattr(entry, "async_unload_platforms"):
		return await entry.async_unload_platforms(PLATFORMS)
	return await hass.config_entries.async_forward_entry_unload(entry, "sensor")
