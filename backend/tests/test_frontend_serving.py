"""The API serves the built frontend (static files plus the SPA fallback) only when the dist folder exists."""

import json

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app

INDEX = "<!doctype html><title>Mercao</title>"


def make_client(tmp_path, dist_dir) -> TestClient:  # noqa: ANN001
    models = tmp_path / "models"
    models.mkdir(exist_ok=True)
    (models / "metadata.json").write_text(json.dumps({}), encoding="utf-8")
    settings = Settings(data_dir=tmp_path, models_dir=models, frontend_dist_dir=dist_dir,
                        database_url=f"sqlite:///{(tmp_path / 'empty.db').as_posix()}")
    return TestClient(create_app(settings))


@pytest.fixture
def dist(tmp_path):
    folder = tmp_path / "dist"
    (folder / "assets").mkdir(parents=True)
    (folder / "index.html").write_text(INDEX, encoding="utf-8")
    (folder / "assets" / "app.js").write_text("console.info('mercao');", encoding="utf-8")
    return folder


def test_serves_index_at_root(tmp_path, dist):
    response = make_client(tmp_path, dist).get("/")
    assert response.status_code == 200
    assert response.text == INDEX
    assert response.headers["content-type"].startswith("text/html")


def test_serves_static_assets(tmp_path, dist):
    response = make_client(tmp_path, dist).get("/assets/app.js")
    assert response.status_code == 200
    assert response.text == "console.info('mercao');"
    assert "javascript" in response.headers["content-type"]


@pytest.mark.parametrize("route", ["/producto", "/oportunidades?producto=3&horizonte=4", "/como-funciona/algo"])
def test_client_routes_fall_back_to_index(tmp_path, dist, route):
    response = make_client(tmp_path, dist).get(route)
    assert response.status_code == 200
    assert response.text == INDEX


def test_unknown_api_routes_stay_json_404(tmp_path, dist):
    client = make_client(tmp_path, dist)
    response = client.get("/api/no-existe")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert client.get("/openapi.json").headers["content-type"].startswith("application/json")


def test_files_outside_dist_are_not_served(tmp_path, dist):
    (tmp_path / "secret.txt").write_text("secret", encoding="utf-8")
    response = make_client(tmp_path, dist).get("/..%2Fsecret.txt")
    assert response.text == INDEX


def test_without_dist_only_the_api_is_served(tmp_path):
    client = make_client(tmp_path, tmp_path / "missing")
    assert client.get("/").status_code == 404
    assert client.get("/producto").status_code == 404
