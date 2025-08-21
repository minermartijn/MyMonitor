"""Helpers for MyMonitor integration."""
import aiohttp

async def check_endpoint(session, url, method="GET", expected=200):
    try:
        async with session.request(method, url) as resp:
            return resp.status == expected
    except Exception:
        return False
