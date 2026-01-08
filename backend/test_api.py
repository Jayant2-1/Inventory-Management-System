from typing import Dict, Iterator, List

import pytest
from fastapi.testclient import TestClient

from backend.main import app, rebuild_inventory


@pytest.fixture(autouse=True)
def reset_inventory() -> Iterator[None]:
    """Ensure each test starts with a clean in-memory dataset."""
    rebuild_inventory(0)
    yield
    rebuild_inventory(0)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _assert_items_equal(items: List[Dict[str, object]], expected_names: List[str]) -> None:
    assert [item["name"] for item in items] == expected_names


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_read_update_delete_flow(client: TestClient) -> None:
    create_response = client.post(
        "/items/",
        json={"name": "Keyboard", "category": "Electronics", "price": 49.99, "quantity": 20},
    )
    assert create_response.status_code == 200
    item_id = create_response.json()["id"]

    get_response = client.get(f"/items/{item_id}")
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["name"] == "Keyboard"
    assert payload["quantity"] == 20

    update_response = client.put(f"/items/{item_id}", json={"price": 39.99})
    assert update_response.status_code == 200

    refreshed = client.get(f"/items/{item_id}")
    assert refreshed.status_code == 200
    assert refreshed.json()["price"] == 39.99

    delete_response = client.delete(f"/items/{item_id}")
    assert delete_response.status_code == 200

    missing_response = client.get(f"/items/{item_id}")
    assert missing_response.status_code == 404


def test_collection_and_queries(client: TestClient) -> None:
    first = client.post(
        "/items/",
        json={"name": "Keyboard", "category": "Electronics", "price": 49.99, "quantity": 20},
    )
    second = client.post(
        "/items/",
        json={"name": "Office Chair", "category": "Furniture", "price": 89.99, "quantity": 5},
    )
    assert first.status_code == 200
    assert second.status_code == 200

    listing = client.get("/items/")
    assert listing.status_code == 200
    items = listing.json()
    _assert_items_equal(items, ["Keyboard", "Office Chair"])

    search_name = client.get("/items/search/name/", params={"name": "Key"})
    assert search_name.status_code == 200
    assert len(search_name.json()) == 1

    search_category = client.get("/items/search/category/", params={"category": "Electronics"})
    assert search_category.status_code == 200
    assert len(search_category.json()) == 1

    low_stock = client.get("/low-stock/", params={"threshold": 10})
    assert low_stock.status_code == 200
    assert len(low_stock.json()) == 1

    stats = client.get("/statistics/")
    assert stats.status_code == 200
    data = stats.json()
    assert data["total_items"] == 2
    assert data["total_value"] == pytest.approx(49.99 * 20 + 89.99 * 5)


def test_tree_info_and_visualization(client: TestClient) -> None:
    for name in ("Alpha", "Bravo", "Charlie"):
        resp = client.post(
            "/items/",
            json={"name": name, "category": "Test", "price": 10.0, "quantity": 1},
        )
        assert resp.status_code == 200

    tree_info = client.get("/tree-info/")
    assert tree_info.status_code == 200
    payload = tree_info.json()
    assert payload["count"] == 3
    assert isinstance(payload["nodes"], list)

    # Visualization lives under "visualization" key in fallback implementation
    visualization = payload.get("visualization")
    if visualization is not None:
        assert isinstance(visualization, list)
        assert len(visualization) >= 1
