"""Local password-reset links must open Vite, not the FastAPI dist UI."""
import os
import sys

backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend)
sys.path.insert(0, os.path.join(backend, "db"))
os.environ.setdefault("JWT_SECRET", "test-secret-for-reset-link")

from auth_utils import frontend_base_for_reset_link, local_vite_auth_redirect


def test_local_vite_origin_is_preferred_over_api_host():
    assert (
        frontend_base_for_reset_link("localhost:8000", "http://localhost:5173")
        == "http://localhost:5173"
    )
    assert (
        frontend_base_for_reset_link("localhost:8000", "http://localhost:5174")
        == "http://localhost:5174"
    )
    assert (
        frontend_base_for_reset_link("127.0.0.1:8000", "http://127.0.0.1:5173")
        == "http://127.0.0.1:5173"
    )


def test_local_request_without_origin_defaults_to_vite():
    assert frontend_base_for_reset_link("localhost:8000", "") == "http://localhost:5173"


def test_api_origin_on_8000_is_not_used_as_the_ui():
    assert frontend_base_for_reset_link("localhost:8000", "http://localhost:8000") == "http://localhost:5173"
    assert (
        frontend_base_for_reset_link("localhost:8000", "", "http://localhost:5174/forgot-password")
        == "http://localhost:5174"
    )


def test_production_host_is_unchanged():
    assert (
        frontend_base_for_reset_link("shoelotskey-villamor-pasay.herokuapp.com", "http://evil.example")
        == "https://shoelotskey-villamor-pasay.herokuapp.com"
    )
    assert (
        frontend_base_for_reset_link("www.shoelotskey-villamor-pasay.app", "")
        == "https://www.shoelotskey-villamor-pasay.app"
    )


def test_stale_local_reset_url_redirects_to_vite():
    assert (
        local_vite_auth_redirect("localhost:8000", "reset-password", "token=abc")
        == "http://localhost:5173/reset-password?token=abc"
    )
    assert local_vite_auth_redirect("localhost:8000", "api/forgot-password") is None
    assert local_vite_auth_redirect("shoelotskey-villamor-pasay.app", "reset-password") is None


if __name__ == "__main__":
    test_local_vite_origin_is_preferred_over_api_host()
    test_local_request_without_origin_defaults_to_vite()
    test_api_origin_on_8000_is_not_used_as_the_ui()
    test_production_host_is_unchanged()
    test_stale_local_reset_url_redirects_to_vite()
    print("ok")
