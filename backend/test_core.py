from typing import Any, Dict, List, cast

from inventory_core import InventoryManager


def test_inventory_crud_and_stats():
    inventory = InventoryManager()

    laptop_id = inventory.add_item("Laptop", "Electronics", 999.99, 10)
    mouse_id = inventory.add_item("Mouse", "Electronics", 29.99, 50)
    desk_id = inventory.add_item("Desk", "Furniture", 199.99, 5)

    assert laptop_id != mouse_id != desk_id

    laptop = inventory.get_item(laptop_id)
    assert laptop is not None
    assert isinstance(laptop, dict)
    assert laptop["name"] == "Laptop"
    assert laptop["quantity"] == 10

    all_items = cast(List[Dict[str, Any]], inventory.get_all_items())
    assert len(all_items) == 3
    assert all(isinstance(item, dict) for item in all_items)
    assert all(item["id"] in {laptop_id, mouse_id, desk_id} for item in all_items)

    removed = inventory.remove_item(mouse_id)
    assert removed is True
    assert inventory.get_item(mouse_id) is None

    stats = cast(Dict[str, Any], inventory.get_statistics())
    assert stats["total_items"] == 2
    assert stats["total_value"] == 999.99 * 10 + 199.99 * 5
    assert stats["tree_height"] >= 1


def test_search_and_low_stock_helpers():
    inventory = InventoryManager()
    inventory.add_item("Laptop", "Electronics", 999.99, 10)
    inventory.add_item("Lamp", "Lighting", 49.99, 3)
    inventory.add_item("Desk Lamp", "Lighting", 59.99, 2)

    search_results = cast(List[Dict[str, Any]], inventory.search_by_name("Lamp"))
    assert len(search_results) == 2
    assert {item["name"] for item in search_results} == {"Lamp", "Desk Lamp"}

    lighting_items = cast(List[Dict[str, Any]], inventory.search_by_category("Lighting"))
    assert len(lighting_items) == 2

    low_stock = cast(List[Dict[str, Any]], inventory.get_low_stock(3))
    assert len(low_stock) == 2
    assert all(item["quantity"] <= 3 for item in low_stock)