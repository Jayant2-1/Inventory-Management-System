from __future__ import annotations

from math import ceil, log2
from typing import Any, Dict, List, Optional, TypedDict


class InventoryItem(TypedDict):
    id: int
    name: str
    category: str
    price: float
    quantity: int


class InventoryStats(TypedDict):
    total_items: int
    total_value: float
    tree_height: int
    unique_categories: int


class InventoryManager:
    """In-memory inventory backed by a dictionary keyed by auto-incrementing IDs."""

    def __init__(self) -> None:
        self._items: Dict[int, InventoryItem] = {}
        self._next_id: int = 1

    def add_item(self, name: str, category: str, price: float, quantity: int) -> int:
        item_id = self._next_id
        self._next_id += 1
        item: InventoryItem = {
            "id": item_id,
            "name": name,
            "category": category,
            "price": price,
            "quantity": quantity,
        }
        self._items[item_id] = item
        return item_id

    def remove_item(self, item_id: int) -> bool:
        if item_id in self._items:
            del self._items[item_id]
            return True
        return False

    def get_item(self, item_id: int) -> Optional[InventoryItem]:
        return self._items.get(item_id)

    def get_all_items(self) -> List[InventoryItem]:
        # Return items sorted by id to mimic in-order traversal effect from BST
        return [self._items[key] for key in sorted(self._items.keys())]

    def get_statistics(self) -> InventoryStats:
        items = self.get_all_items()
        total_items = len(items)
        total_value = sum(item["price"] * item["quantity"] for item in items)
        tree_height = ceil(log2(total_items + 1)) if total_items > 0 else 0
        unique_categories = len({item["category"] for item in items})
        return {
            "total_items": total_items,
            "total_value": total_value,
            "tree_height": tree_height,
            "unique_categories": unique_categories,
        }

    def update_item(
        self,
        item_id: int,
        name: str,
        category: str,
        price: float,
        quantity: int,
    ) -> bool:
        if item_id not in self._items:
            return False
        self._items[item_id] = {
            "id": item_id,
            "name": name,
            "category": category,
            "price": price,
            "quantity": quantity,
        }
        return True

    def search_by_name(self, name: str) -> List[InventoryItem]:
        query = name.lower()
        return [item for item in self.get_all_items() if query in item["name"].lower()]

    def search_by_category(self, category: str) -> List[InventoryItem]:
        query = category.lower()
        return [item for item in self.get_all_items() if item["category"].lower() == query]

    def get_low_stock(self, threshold: int) -> List[InventoryItem]:
        return [item for item in self.get_all_items() if item["quantity"] <= threshold]

    def get_tree_info(self) -> Dict[str, Any]:
        items = self.get_all_items()
        return {
            "nodes": items,
            "count": len(items),
            "height": ceil(log2(len(items) + 1)) if items else 0,
        }

    def get_tree_visualization(self) -> List[str]:
        """Produce a deterministic AVL-inspired ASCII visualization of the inventory."""
        items = self.get_all_items()
        if not items:
            return ["Tree is empty"]

        class Node:
            __slots__ = ("item", "left", "right", "height")

            def __init__(self, item: InventoryItem) -> None:
                self.item: InventoryItem = item
                self.left: Optional["Node"] = None
                self.right: Optional["Node"] = None
                self.height: int = 1

        def height(node: Optional[Node]) -> int:
            return node.height if node else 0

        def update_height(node: Optional[Node]) -> None:
            if node:
                node.height = 1 + max(height(node.left), height(node.right))

        def get_balance(node: Optional[Node]) -> int:
            return height(node.left) - height(node.right) if node else 0

        def right_rotate(y: Node) -> Node:
            x = y.left
            assert x is not None
            t2 = x.right
            x.right = y
            y.left = t2
            update_height(y)
            update_height(x)
            return x

        def left_rotate(x: Node) -> Node:
            y = x.right
            assert y is not None
            t2 = y.left
            y.left = x
            x.right = t2
            update_height(x)
            update_height(y)
            return y

        def avl_insert(node: Optional[Node], item: InventoryItem) -> Node:
            if node is None:
                return Node(item)

            if item["id"] < node.item["id"]:
                node.left = avl_insert(node.left, item)
            elif item["id"] > node.item["id"]:
                node.right = avl_insert(node.right, item)
            else:
                node.item = item
                return node

            update_height(node)
            balance = get_balance(node)

            if balance > 1 and item["id"] < node.left.item["id"]:  # type: ignore[union-attr]
                return right_rotate(node)
            if balance < -1 and item["id"] > node.right.item["id"]:  # type: ignore[union-attr]
                return left_rotate(node)
            if balance > 1 and item["id"] > node.left.item["id"]:  # type: ignore[union-attr]
                assert node.left is not None
                node.left = left_rotate(node.left)
                return right_rotate(node)
            if balance < -1 and item["id"] < node.right.item["id"]:  # type: ignore[union-attr]
                assert node.right is not None
                node.right = right_rotate(node.right)
                return left_rotate(node)

            return node

        root: Optional[Node] = None
        for item in items:
            root = avl_insert(root, item)

        def ascii_lines(node: Optional[Node]) -> List[str]:
            lines: List[str] = []

            def _helper(cur: Optional[Node], prefix: str = "", is_left: bool = True, is_root: bool = False) -> None:
                if cur is None:
                    return

                balance = get_balance(cur)
                node_label = f"[{cur.item['id']}] {cur.item['name']} (H:{cur.height}, B:{balance})"
                if is_root:
                    lines.append(node_label)
                else:
                    branch = "├── " if is_left else "└── "
                    lines.append(prefix + branch + node_label)

                next_prefix = "" if is_root else prefix + ("│   " if is_left else "    ")
                _helper(cur.left, next_prefix, True, False)
                _helper(cur.right, next_prefix, False, False)

            _helper(node, is_root=True)
            return lines

        return ascii_lines(root)

    def get_tree_hierarchy(self) -> Dict[str, List[List[Dict[str, Any]]]]:
        items = self.get_all_items()
        levels: List[List[Dict[str, Any]]] = []

        if not items:
            return {"levels": levels}

        class Node:
            __slots__ = ("item", "left", "right", "height")

            def __init__(self, item: InventoryItem) -> None:
                self.item: InventoryItem = item
                self.left: Optional["Node"] = None
                self.right: Optional["Node"] = None
                self.height: int = 1

        def height(node: Optional[Node]) -> int:
            return node.height if node else 0

        def update_height(node: Optional[Node]) -> None:
            if node:
                node.height = 1 + max(height(node.left), height(node.right))

        def get_balance(node: Optional[Node]) -> int:
            return height(node.left) - height(node.right) if node else 0

        def right_rotate(y: Node) -> Node:
            x = y.left
            assert x is not None
            t2 = x.right
            x.right = y
            y.left = t2
            update_height(y)
            update_height(x)
            return x

        def left_rotate(x: Node) -> Node:
            y = x.right
            assert y is not None
            t2 = y.left
            y.left = x
            x.right = t2
            update_height(x)
            update_height(y)
            return y

        def avl_insert(node: Optional[Node], item: InventoryItem) -> Node:
            if node is None:
                return Node(item)

            if item["id"] < node.item["id"]:
                node.left = avl_insert(node.left, item)
            elif item["id"] > node.item["id"]:
                node.right = avl_insert(node.right, item)
            else:
                node.item = item
                return node

            update_height(node)
            balance = get_balance(node)

            if balance > 1 and item["id"] < node.left.item["id"]:  # type: ignore[union-attr]
                return right_rotate(node)
            if balance < -1 and item["id"] > node.right.item["id"]:  # type: ignore[union-attr]
                return left_rotate(node)
            if balance > 1 and item["id"] > node.left.item["id"]:  # type: ignore[union-attr]
                assert node.left is not None
                node.left = left_rotate(node.left)
                return right_rotate(node)
            if balance < -1 and item["id"] < node.right.item["id"]:  # type: ignore[union-attr]
                assert node.right is not None
                node.right = right_rotate(node.right)
                return left_rotate(node)

            return node

        root: Optional[Node] = None
        for item in items:
            root = avl_insert(root, item)

        queue: List[Optional[Node]] = [root]
        while any(node is not None for node in queue):
            next_queue: List[Optional[Node]] = []
            level: List[Dict[str, Any]] = []
            for node in queue:
                if node is None:
                    level.append({})
                    next_queue.extend([None, None])
                else:
                    level.append(
                        {
                            "id": node.item["id"],
                            "name": node.item["name"],
                            "height": node.height,
                            "balance": get_balance(node),
                            "has_left": node.left is not None,
                            "has_right": node.right is not None,
                            "depth": None,
                        }
                    )
                    next_queue.append(node.left)
                    next_queue.append(node.right)
            levels.append(level)
            queue = next_queue

        return {"levels": levels}
