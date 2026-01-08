import asyncio
import importlib.util
import sys
from importlib import import_module
from pathlib import Path
from typing import Any, List, Optional, Type

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _load_inventory_manager() -> Type[Any]:
    """Load the inventory core, preferring the compiled extension when available."""

    try:
        module = import_module("inventory_core")
        origin = getattr(module, "__file__", "compiled extension (binary)")
        print(f"Using inventory core from {origin}")
    except Exception as exc:  # pragma: no cover - defensive fallback
        module_path = PROJECT_ROOT / "inventory_core.py"
        if not module_path.exists():
            raise ImportError("Failed to import inventory_core module") from exc

        spec = importlib.util.spec_from_file_location("inventory_core", module_path)
        if spec is None or spec.loader is None:
            raise ImportError("Unable to load Python fallback for inventory_core") from exc

        module = importlib.util.module_from_spec(spec)
        sys.modules["inventory_core"] = module
        spec.loader.exec_module(module)
        print(f"Falling back to pure-Python inventory core at {module_path}")

    manager = getattr(module, "InventoryManager", None)
    if manager is None:
        raise ImportError("inventory_core module does not expose InventoryManager")

    return manager  # type: ignore[return-value]


InventoryManager = _load_inventory_manager()

app = FastAPI(
    title="High-Performance Inventory API",
    description="BST-based Inventory Management System", 
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize inventory manager
inventory = InventoryManager()

TARGET_ITEM_COUNT = 100

DEMO_ITEMS = (
    {"name": "Atlas Hammer Pro", "category": "Hand Tools", "price": 24.99, "quantity": 18},
    {"name": "Nova Drill 18V", "category": "Power Tools", "price": 149.0, "quantity": 9},
    {"name": "Precision Screw Set", "category": "Fasteners", "price": 17.5, "quantity": 42},
    {"name": "AquaFlow Pipe Kit", "category": "Plumbing", "price": 68.75, "quantity": 14},
    {"name": "VoltGuard Multimeter", "category": "Electrical", "price": 89.99, "quantity": 11},
    {"name": "ShieldSafe Gloves", "category": "Safety", "price": 12.25, "quantity": 60},
    {"name": "EarthTone Paint Duo", "category": "Paint", "price": 33.4, "quantity": 25},
    {"name": "BondFlex Adhesive", "category": "Adhesives", "price": 21.6, "quantity": 30},
    {"name": "IronClad Brackets", "category": "Hardware", "price": 15.85, "quantity": 55},
    {"name": "GreenLeaf Pruner", "category": "Garden", "price": 44.2, "quantity": 16},
    {"name": "BrightBeam LED Strip", "category": "Lighting", "price": 29.99, "quantity": 22},
    {"name": "FloorMaster Laminate", "category": "Flooring", "price": 79.5, "quantity": 12},
    {"name": "RoofGuard Shingles", "category": "Roofing", "price": 156.0, "quantity": 8},
    {"name": "EntryGuard Door Lock", "category": "Doors & Windows", "price": 67.25, "quantity": 19},
    {"name": "ClimateControl Unit", "category": "HVAC", "price": 299.99, "quantity": 5},
    {"name": "SmartFridge Pro", "category": "Appliances", "price": 899.0, "quantity": 3},
    {"name": "CleanSweep Vacuum", "category": "Cleaning", "price": 189.5, "quantity": 7},
    {"name": "StorageMax Cabinet", "category": "Storage", "price": 124.75, "quantity": 13},
    {"name": "PatioShade Umbrella", "category": "Outdoor", "price": 89.99, "quantity": 15},
    {"name": "AutoTune Diagnostic", "category": "Automotive", "price": 199.0, "quantity": 6},
)


def _generate_seed_items(desired_count: int) -> List[dict]:
    if desired_count <= 0:
        return []

    items: List[dict] = []
    base = list(DEMO_ITEMS)
    loops = (desired_count + len(base) - 1) // len(base)

    for loop in range(loops):
        for item in base:
            if len(items) >= desired_count:
                break
            suffix = "" if loop == 0 else f" #{loop + 1}"
            items.append(
                {
                    "name": f"{item['name']}{suffix}",
                    "category": item["category"],
                    "price": item["price"],
                    "quantity": item["quantity"],
                }
            )
    return items


def rebuild_inventory(desired_count: int = TARGET_ITEM_COUNT) -> int:
    """Reset the in-memory inventory to a controlled demo dataset."""
    global inventory

    manager = InventoryManager()
    seed_items = _generate_seed_items(desired_count)

    for payload in seed_items:
        try:
            manager.add_item(
                payload["name"],
                payload["category"],
                payload["price"],
                payload["quantity"],
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"seed: failed to insert {payload['name']}: {exc}")

    inventory = manager
    return len(manager.get_all_items())

# ... rest of your main.py code continues unchanged ...
# Startup seeding: ensure we have at least N sample hardware items for the demo
@app.on_event("startup")
async def seed_sample_items():
    try:
        await asyncio.sleep(0.01)
        total = rebuild_inventory(TARGET_ITEM_COUNT)
        print(f"seed: demo dataset prepared with {total} items")
    except Exception as e:  # pragma: no cover - startup resilience
        print(f"seed: failed: {e}")

# Pydantic models
class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)

class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)

class ItemResponse(BaseModel):
    id: int
    name: str
    category: str
    price: float
    quantity: int

class StatisticsResponse(BaseModel):
    total_items: int
    total_value: float
    tree_height: int
    unique_categories: int

# API Routes
@app.post("/items/", response_model=dict)
async def create_item(item: ItemCreate):
    """Add new item to inventory"""
    try:
        item_id = inventory.add_item(
            item.name, item.category, item.price, item.quantity
        )
        return {"message": "Item added successfully", "id": item_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/items/", response_model=List[ItemResponse])
async def get_all_items():
    """Get all items from inventory"""
    try:
        items = inventory.get_all_items()
        return [ItemResponse(**item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int):
    """Get specific item by ID"""
    try:
        item = inventory.get_item(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return ItemResponse(**item)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/items/{item_id}")
async def update_item(item_id: int, item: ItemUpdate):
    """Update existing item"""
    try:
        # Get current item
        current = inventory.get_item(item_id)
        if not current:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Update only provided fields
        update_data = {
            "name": item.name or current["name"],
            "category": item.category or current["category"],
            "price": item.price or current["price"],
            "quantity": item.quantity or current["quantity"]
        }
        
        success = inventory.update_item(
            item_id, 
            update_data["name"],
            update_data["category"],
            update_data["price"],
            update_data["quantity"]
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update item")
            
        return {"message": "Item updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/items/{item_id}")
async def delete_item(item_id: int):
    """Delete item from inventory"""
    try:
        success = inventory.remove_item(item_id)
        if not success:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/items/search/name/")
async def search_by_name(name: str = Query(..., min_length=1)):
    """Search items by name"""
    try:
        items = inventory.search_by_name(name)
        return [ItemResponse(**item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/items/search/category/")
async def search_by_category(category: str = Query(..., min_length=1)):
    """Search items by category"""
    try:
        items = inventory.search_by_category(category)
        return [ItemResponse(**item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/statistics/", response_model=StatisticsResponse)
async def get_statistics():
    """Get inventory statistics"""
    try:
        stats = inventory.get_statistics()
        return StatisticsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/low-stock/")
async def get_low_stock(threshold: int = Query(5, ge=0)):
    """Get low stock items"""
    try:
        items = inventory.get_low_stock(threshold)
        return [ItemResponse(**item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tree-info/")
async def get_tree_info():
    """Get BST structure information"""
    try:
        # Try to use the core's get_tree_info if it returns rich data
        tree_info = inventory.get_tree_info()

        # Detect whether the returned structure contains AVL metrics (balance/depth)
        nodes = tree_info.get('nodes') if isinstance(tree_info, dict) else None
        has_balance = False
        if nodes and isinstance(nodes, list) and len(nodes) > 0:
            # nodes may be dicts coming from C++ wrapper with 'balance' key
            first = nodes[0]
            if isinstance(first, dict) and 'balance' in first:
                has_balance = True

        if has_balance:
            return tree_info

        # Fall back: build an AVL-like structure from the item list and compute metrics
        items = inventory.get_all_items()

        # Simple AVL node class for python-side analysis
        class Node:
            __slots__ = ("item", "left", "right", "height")
            def __init__(self, item):
                self.item = item
                self.left = None
                self.right = None
                self.height = 1

        def height(n):
            return n.height if n else 0

        def update_height(n):
            if n:
                n.height = 1 + max(height(n.left), height(n.right))

        def get_balance(n):
            return (height(n.left) - height(n.right)) if n else 0

        def right_rotate(y):
            x = y.left
            T2 = x.right
            x.right = y
            y.left = T2
            update_height(y)
            update_height(x)
            return x

        def left_rotate(x):
            y = x.right
            T2 = y.left
            y.left = x
            x.right = T2
            update_height(x)
            update_height(y)
            return y

        def avl_insert(node, item):
            if not node:
                return Node(item)
            # Use id as key to reproduce the BST ordering used elsewhere
            if item['id'] < node.item['id']:
                node.left = avl_insert(node.left, item)
            elif item['id'] > node.item['id']:
                node.right = avl_insert(node.right, item)
            else:
                # replace
                node.item = item
                return node

            update_height(node)
            bal = get_balance(node)

            # LL
            if bal > 1 and item['id'] < node.left.item['id']:
                return right_rotate(node)
            # RR
            if bal < -1 and item['id'] > node.right.item['id']:
                return left_rotate(node)
            # LR
            if bal > 1 and item['id'] > node.left.item['id']:
                node.left = left_rotate(node.left)
                return right_rotate(node)
            # RL
            if bal < -1 and item['id'] < node.right.item['id']:
                node.right = right_rotate(node.right)
                return left_rotate(node)

            return node

        # Build AVL from items in the order returned by inventory.get_all_items()
        root = None
        for it in items:
            root = avl_insert(root, it)

        # Collect node info via in-order traversal with depth
        nodes_out = []
        def inorder(n, depth=0):
            if not n: return
            inorder(n.left, depth+1)
            nodes_out.append({
                'id': n.item['id'],
                'name': n.item['name'],
                'category': n.item['category'],
                'price': n.item.get('price', 0.0),
                'quantity': n.item.get('quantity', 0),
                'balance': get_balance(n),
                'depth': depth,
                'height': n.height
            })
            inorder(n.right, depth+1)

        inorder(root, 0)

        # metrics
        count = len(nodes_out)
        total_value = sum(n['price'] * n['quantity'] for n in nodes_out)
        tree_height = root.height if root else 0
        well_balanced = sum(1 for n in nodes_out if abs(n['balance']) <= 1)
        total_balance = sum(abs(n['balance']) for n in nodes_out)
        balance_quality = (well_balanced * 100.0 / count) if count else 100.0
        avg_balance = (total_balance / count) if count else 0.0

        return {
            'nodes': nodes_out,
            'count': count,
            'height': tree_height,
            'balance_quality': balance_quality,
            'avg_balance': avg_balance,
            'well_balanced_nodes': well_balanced,
            'is_avl_balanced': (balance_quality > 95.0),
            'total_value': total_value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tree-visualization/')
async def tree_visualization():
    """Return a simple text visualization (list of lines) of the tree used to store items.
    This will use the core's visualization if available; otherwise build a level-order visualization
    from a python-side AVL constructed from items.
    """
    try:
        # try core visualization
        if hasattr(inventory, 'get_tree_visualization'):
            try:
                viz = inventory.get_tree_visualization()
                # If C++ returns a list of strings, wrap them
                if isinstance(viz, list):
                    return {'visualization': viz}
                if isinstance(viz, dict) and 'levels' in viz:
                    # convert hierarchy dict to flattened lines
                    lines = []
                    levels = viz.get('levels', [])
                    lvlnum = 0
                    for lvl in levels:
                        line = f"Level {lvlnum}: "
                        entries = []
                        for node in lvl:
                            if isinstance(node, dict) and node.get('id') is not None:
                                entries.append(f"[{node.get('id')}]({node.get('balance')})")
                            else:
                                entries.append("[.]")
                        lines.append(line + ' '.join(entries))
                        lvlnum += 1
                    return {'visualization': lines}
            except Exception:
                # fall through to python-side visualization
                pass

        # Build python-side AVL and produce level-order lines
        items = inventory.get_all_items()
        # reuse local AVL builder from get_tree_info
        class Node:
            __slots__ = ("item", "left", "right", "height")
            def __init__(self, item):
                self.item = item
                self.left = None
                self.right = None
                self.height = 1

        def height(n):
            return n.height if n else 0

        def update_height(n):
            if n:
                n.height = 1 + max(height(n.left), height(n.right))

        def get_balance(n):
            return (height(n.left) - height(n.right)) if n else 0

        def right_rotate(y):
            x = y.left
            T2 = x.right
            x.right = y
            y.left = T2
            update_height(y)
            update_height(x)
            return x

        def left_rotate(x):
            y = x.right
            T2 = y.left
            y.left = x
            x.right = T2
            update_height(x)
            update_height(y)
            return y

        def avl_insert(node, item):
            if not node:
                return Node(item)
            if item['id'] < node.item['id']:
                node.left = avl_insert(node.left, item)
            elif item['id'] > node.item['id']:
                node.right = avl_insert(node.right, item)
            else:
                node.item = item
                return node
            update_height(node)
            bal = get_balance(node)
            if bal > 1 and item['id'] < node.left.item['id']:
                return right_rotate(node)
            if bal < -1 and item['id'] > node.right.item['id']:
                return left_rotate(node)
            if bal > 1 and item['id'] > node.left.item['id']:
                node.left = left_rotate(node.left)
                return right_rotate(node)
            if bal < -1 and item['id'] < node.right.item['id']:
                node.right = right_rotate(node.right)
                return left_rotate(node)
            return node

        root = None
        for it in items:
            root = avl_insert(root, it)

        # Build a pretty ASCII top-down tree for visualization
        def ascii_lines(n):
            """Return list of lines representing the tree rooted at n."""
            if not n:
                return []

            lines = []

            def _helper(node, prefix='', is_left=True, is_root=False):
                if node is None:
                    return

                # node line
                bal = get_balance(node)
                node_label = f"[{node.item['id']}] {node.item['name']} (H:{node.height}, B:{bal})"
                if is_root:
                    lines.append(node_label)
                else:
                    branch = '├── ' if is_left else '└── '
                    lines.append(prefix + branch + node_label)

                # compute prefix for children
                if is_root:
                    child_prefix = ''
                else:
                    child_prefix = prefix + ('│   ' if is_left else '    ')

                # traverse left then right to keep a natural top-down order
                if node.left:
                    _helper(node.left, child_prefix, True, False)
                if node.right:
                    _helper(node.right, child_prefix, False, False)

            _helper(root, '', True, True)
            return lines

        return {'visualization': ascii_lines(root)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/admin/seed')
async def seed_endpoint(target: Optional[int] = None):
    """Admin endpoint to rebuild the dataset for demos or testing."""
    try:
        desired = TARGET_ITEM_COUNT if target is None else max(0, int(target))
        total = rebuild_inventory(desired)
        return {"inserted": total, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "inventory-api"}


@app.get("/", include_in_schema=False)
async def root_index():
    return {
        "message": "Inventory API is running",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        workers=1  # Since we have global state, use 1 worker
    )

