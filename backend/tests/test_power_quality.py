import asyncio
from unittest.mock import patch
import httpx
import pytest
from app.services.nasa_power_service import fetch_annual_temperature, NASAPowerError
from app.services.trend_analysis_service import analyze_temperature_trend
from app.schemas.climate import TemperatureResponse, TemperatureRecord

@pytest.mark.parametrize('value', [None, -999, float('nan'), float('inf'), 'bad', True])
def test_invalid_annual_values_are_not_silently_dropped(value):
    # Fixture values are used only to test quality control, never in the UI.
    payload={'parameters':{'T2M':{'units':'C'}},'properties':{'parameter':{'T2M':{'202013':value}}}}
    from unittest.mock import AsyncMock, MagicMock
    response=MagicMock();response.json.return_value=payload
    client=AsyncMock();client.get.return_value=response
    with patch('app.services.nasa_power_service.httpx.AsyncClient') as factory:
        factory.return_value.__aenter__.return_value=client
        with pytest.raises(NASAPowerError):asyncio.run(fetch_annual_temperature(0,0,2020,2020))

def test_constant_series_is_finite_and_not_significant():
    data=TemperatureResponse(latitude=0,longitude=0,start_year=2020,end_year=2022,
      records=[TemperatureRecord(year=y,temperature=20) for y in range(2020,2023)])
    result=analyze_temperature_trend(data)
    assert result.slope_celsius_per_decade==0
    assert result.p_value==1 and not result.significant
    assert result.trend=='no_significant_trend'

@pytest.mark.parametrize('field,value',[('latitude','nan'),('longitude','inf'),('longitude',181),('end_year',2099)])
def test_rejected_queries(field,value):
    from fastapi.testclient import TestClient
    from app.main import app
    query=dict(latitude=0,longitude=0,start_year=2020,end_year=2022);query[field]=value
    assert TestClient(app).get('/api/v1/analysis/trends',params=query).status_code==422
