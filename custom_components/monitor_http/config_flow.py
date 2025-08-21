"""Config flow for MyMonitor integration."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from .const import DOMAIN, CONF_NAME, CONF_URL, CONF_METHOD, CONF_EXPECTED, DEFAULT_METHOD, DEFAULT_EXPECTED

class MyMonitorConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for MyMonitor."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data=user_input)

        data_schema = vol.Schema({
            vol.Required(CONF_NAME): str,
            vol.Required(CONF_URL): str,
            vol.Optional(CONF_METHOD, default=DEFAULT_METHOD): str,
            vol.Optional(CONF_EXPECTED, default=DEFAULT_EXPECTED): int,
        })
        return self.async_show_form(step_id="user", data_schema=data_schema, errors=errors)
