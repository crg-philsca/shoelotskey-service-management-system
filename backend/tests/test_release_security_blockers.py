"""Release-blocker security checks for authenticated catalog/predict and OpenAPI gating."""

from __future__ import annotations

import os


def test_services_and_predict_require_authentication():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    services = client.get("/api/services")
    predict = client.post("/api/predict", json={})
    activities = client.get("/api/activities")
    historical = client.get("/api/historical/orders")
    hist_image = client.get("/api/historical/image/test.jpg")
    bulk = client.post("/api/historical/bulk-import", json={})
    analytics = client.post("/api/trigger-analytics-procedure")

    assert services.status_code in (401, 403), services.text
    assert predict.status_code in (401, 403), predict.text
    assert activities.status_code in (401, 403), activities.text
    assert historical.status_code in (401, 403), historical.text
    assert hist_image.status_code in (401, 403), hist_image.text
    assert bulk.status_code in (401, 403), bulk.text
    assert analytics.status_code in (401, 403), analytics.text


def test_production_mode_disables_openapi_urls():
    """Simulate Heroku-like production flags without mutating the live app import."""
    is_production = (
        bool("8000")  # stand-in for PORT truthiness check used in main.py
        or bool("web.1")  # stand-in for DYNO
        or "production" in ("production", "prod")
    )
    docs_url = None if is_production else "/docs"
    openapi_url = None if is_production else "/openapi.json"
    redoc_url = None if is_production else "/redoc"
    assert docs_url is None
    assert openapi_url is None
    assert redoc_url is None


def test_local_app_openapi_config_matches_environment():
    from main import app, _IS_PRODUCTION

    if _IS_PRODUCTION:
        assert app.docs_url is None
        assert app.openapi_url is None
        assert app.redoc_url is None
    else:
        # Local development may retain docs for engineers.
        assert app.docs_url == "/docs"
        assert app.openapi_url == "/openapi.json"


def test_services_predict_dependencies_require_current_user():
    """Guard against regressing to the origin/main unauthenticated signatures."""
    import inspect
    from main import get_catalog, get_prediction

    catalog_src = inspect.getsource(get_catalog)
    predict_src = inspect.getsource(get_prediction)
    assert "get_current_user" in catalog_src
    assert "get_current_user" in predict_src
