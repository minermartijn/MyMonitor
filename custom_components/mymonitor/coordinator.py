"""Coordinator for polling HTTP/Service endpoints."""

import logging
import aiohttp
_LOGGER = logging.getLogger(__name__)

from datetime import timedelta
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.core import HomeAssistant
from .helpers import check_endpoint
import asyncio

class MonitorHttpCoordinator(DataUpdateCoordinator):
	def __init__(self, hass: HomeAssistant, name, url, method, expected, interval=60):
		super().__init__(
			hass,
			_LOGGER,
			name=name,
			update_interval=timedelta(seconds=interval),
		)
		self.url = url
		self.method = method
		self.expected = expected
		self.history = []  # List of (timestamp, up/down)

	async def _async_update_data(self):
		async with aiohttp.ClientSession() as session:
			up = await check_endpoint(session, self.url, self.method, self.expected)
		# Store history (timestamp, up/down)
		from datetime import datetime
		self.history.append((datetime.now().isoformat(), up))
		# Keep only last 24h (or N points)
		self.history = self.history[-1440:]
		return up
