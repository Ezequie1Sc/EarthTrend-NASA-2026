
import math
import httpx

from app.core.config import settings
from app.schemas.climate import TemperatureRecord, TemperatureResponse


class NASAPowerError(Exception):
    pass


async def fetch_annual_temperature(
    latitude: float,
    longitude: float,
    start_year: int,
    end_year: int,
) -> TemperatureResponse:
    url = f"{settings.NASA_POWER_BASE_URL}/monthly/point"

    params = {
        "parameters": "T2M",
        "community": "SB",
        "latitude": latitude,
        "longitude": longitude,
        "start": start_year,
        "end": end_year,
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NASAPowerError(
            "Unable to retrieve data from NASA POWER."
        ) from exc

    try:
        values = payload["properties"]["parameter"]["T2M"]
    except (KeyError, TypeError) as exc:
        raise NASAPowerError(
            "NASA POWER returned an unexpected response."
        ) from exc

    if not isinstance(values, dict):
        raise NASAPowerError("NASA POWER returned invalid T2M data.")
    unit = payload.get("parameters", {}).get("T2M", {}).get("units")
    if unit not in ("C", "°C", "degC"):
        raise NASAPowerError("NASA POWER T2M units are missing or not Celsius.")
    fill = payload.get("header", {}).get("fill_value", -999)
    records = []

    for year in range(start_year, end_year + 1):
        key = f"{year}13"
        value = values.get(key)

        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or value in (-999, fill)):
            raise NASAPowerError(f"NASA POWER has no valid annual T2M for {year}. Choose a fully covered period.")

        records.append(
            TemperatureRecord(
                year=year,
                temperature=float(value),
            )
        )

    return TemperatureResponse(
        latitude=latitude,
        longitude=longitude,
        start_year=start_year,
        end_year=end_year,
        records=records,
    )
