from typing import Dict, Iterator, List

import pytest

from backend.main import (
    ItemCreate,
    ItemUpdate,
    create_item,
    delete_item,
    get_all_items,
    get_low_stock,
    get_statistics,
    get_tree_info,
    rebuild_inventory,
    search_by_category,
    search_by_name,
    update_item,
)


@pytest.fixture(autouse=True)
def reset_inventory() -> Iterator[None]:
    rebuild_inventory(0)
    yield
    rebuild_inventory(0)


@pytest.mark.asyncio
async def test_async_service_layer_flows() -> None:
    first = await create_item(
        ItemCreate(name="Keyboard", category="Electronics", price=49.99, quantity=20)
    )
    second = await create_item(
        ItemCreate(name="Chair", category="Furniture", price=89.99, quantity=5)
    )

    assert first["message"] == "Item added successfully"
    assert second["message"] == "Item added successfully"
    first_id = first["id"]
    second_id = second["id"]

    all_items = await get_all_items()
    assert len(all_items) == 2

    stats = await get_statistics()
    stats_payload = stats.model_dump() if hasattr(stats, "model_dump") else stats
    assert stats_payload["total_items"] == 2

    name_search = await search_by_name(name="Key")
    assert len(name_search) == 1

    category_search = await search_by_category(category="Electronics")
    assert len(category_search) == 1

    low_stock = await get_low_stock(threshold=10)
    assert len(low_stock) == 1

    tree = await get_tree_info()
    assert tree["count"] == 2

    update_result = await update_item(first_id, ItemUpdate(price=39.99))
    assert update_result["message"] == "Item updated successfully"

    delete_result = await delete_item(second_id)
    assert delete_result["message"] == "Item deleted successfully"

    final_items = await get_all_items()
    assert len(final_items) == 1
