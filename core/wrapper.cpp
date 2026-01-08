#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <unordered_set>
#include <cmath>
#include "bst.h"
using namespace std;
using namespace pybind11;
namespace py = pybind11;
using namespace pybind11::literals;

class PyInventoryManager {
private:
    InventoryBST bst;
    int next_id = 1;

    // Helper to get node information including balance factors
    void inOrderWithBalance(BSTNode* node, vector<dict>& results, int depth) const {
        if (!node) return;
        
        inOrderWithBalance(node->left.get(), results, depth + 1);
        
        // Calculate balance factor
        int left_height = node->left ? node->left->height : 0;
        int right_height = node->right ? node->right->height : 0;
        int balance = left_height - right_height;
        
        results.push_back(dict(
            "id"_a = node->data.id,
            "name"_a = node->data.name,
            "category"_a = node->data.category,
            "price"_a = node->data.price,
            "quantity"_a = node->data.quantity,
            "balance"_a = balance,
            "depth"_a = depth,
            "height"_a = node->height
        ));
        
        inOrderWithBalance(node->right.get(), results, depth + 1);
    }

public:
    // Add this method to show tree structure
list get_tree_visualization() const {
    list result;
    
    // Helper function for level-order traversal
    function<void(BSTNode*, int, const string&)> traverse;
    traverse = [&](BSTNode* node, int level, const string& prefix) {
        if (!node) return;
        
        // Add current node with visualization
        string visualization = prefix + "[" + to_string(node->data.id) + "] " + node->data.name;
        
        // Calculate balance factor
        int left_height = node->left ? node->left->height : 0;
        int right_height = node->right ? node->right->height : 0;
        int balance = left_height - right_height;
        
        string node_info = visualization + " (H:" + to_string(node->height) + 
                          ", B:" + to_string(balance) + ")";
        
        result.append(node_info);
        
        // Recursively traverse children with proper indentation
        string child_prefix = prefix + "    ";
        traverse(node->left.get(), level + 1, child_prefix + "L: ");
        traverse(node->right.get(), level + 1, child_prefix + "R: ");
    };
    
    traverse(bst.getRoot(), 0, "Root: ");
    return result;
}

// Alternative: Level-order traversal for better tree structure
dict get_tree_hierarchy() const {
    if (!bst.getRoot()) return dict();
    
    list levels;
    queue<BSTNode*> q;
    q.push(bst.getRoot());
    
    while (!q.empty()) {
        int level_size = q.size();
        list current_level;
        
        for (int i = 0; i < level_size; ++i) {
            BSTNode* current = q.front();
            q.pop();
            
            if (current) {
                // Calculate balance factor
                int left_height = current->left ? current->left->height : 0;
                int right_height = current->right ? current->right->height : 0;
                int balance = left_height - right_height;
                
                dict node_info = dict(
                    "id"_a = current->data.id,
                    "name"_a = current->data.name,
                    "height"_a = current->height,
                    "balance"_a = balance,
                    "has_left"_a = (current->left != nullptr),
                    "has_right"_a = (current->right != nullptr)
                );
                current_level.append(node_info);
                
                // Add children to queue
                q.push(current->left.get());
                q.push(current->right.get());
            } else {
                // Null node
                current_level.append(dict());
            }
        }
        levels.append(current_level);
    }
    
    return dict("levels"_a = levels);
}

    int add_item(const string& name, const string& category,
                double price, int quantity) {
        Item item(next_id++, name, category, price, quantity);
        bst.insert(item);
        return item.id;
    }
    
    bool remove_item(int id) {
        return bst.remove(id);
    }
    
    dict get_item(int id) const {
        Item* item = bst.search(id);
        if (item) {
            return dict(
                "id"_a = item->id,
                "name"_a = item->name,
                "category"_a = item->category,
                "price"_a = item->price,
                "quantity"_a = item->quantity
            );
        }
        return dict();
    }
    
    list get_all_items() const {
        auto items = bst.getAllItems();
        list result;
        for (const auto& item : items) {
            result.append(dict(
                "id"_a = item.id,
                "name"_a = item.name,
                "category"_a = item.category,
                "price"_a = item.price,
                "quantity"_a = item.quantity
            ));
        }
        return result;
    }
    
    dict get_statistics() const {
        auto items = bst.getAllItems();
        unordered_set<string> cats;
        for (const auto &it : items) cats.insert(it.category);
        
        // Calculate actual tree statistics
        double total_value = bst.getTotalValue();
        int tree_height = bst.getTreeHeight();
        size_t item_count = bst.getItemCount();
        
        // Calculate balance quality (percentage of nodes with balance factor in [-1, 1])
        vector<dict> balanced_nodes;
        inOrderWithBalance(bst.getRoot(), balanced_nodes, 0);
        
        int well_balanced = 0;
        double total_depth = 0;
        for (const auto& node : balanced_nodes) {
            int balance = node["balance"].cast<int>();
            if (abs(balance) <= 1) well_balanced++;
            total_depth += node["depth"].cast<int>();
        }
        
        double balance_quality = balanced_nodes.empty() ? 100.0 : 
            (well_balanced * 100.0) / balanced_nodes.size();
        double avg_depth = balanced_nodes.empty() ? 0.0 : total_depth / balanced_nodes.size();
        
        return dict(
            "total_items"_a = static_cast<int>(item_count),
            "total_value"_a = total_value,
            "tree_height"_a = tree_height,
            "unique_categories"_a = static_cast<int>(cats.size()),
            "balance_quality"_a = balance_quality,
            "avg_depth"_a = avg_depth,
            "is_balanced"_a = (balance_quality > 95.0)  // Consider balanced if 95%+ nodes are balanced
        );
    }

    bool update_item(int id, const string &name, const string &category,
                     double price, int quantity) {
        Item item(id, name, category, price, quantity);
        return bst.update(item);
    }

    list search_by_name(const string &name) const {
        auto results = bst.searchByName(name);
        list out;
        for (const auto &item : results) {
            out.append(dict(
                "id"_a = item.id,
                "name"_a = item.name,
                "category"_a = item.category,
                "price"_a = item.price,
                "quantity"_a = item.quantity
            ));
        }
        return out;
    }

    list search_by_category(const string &category) const {
        auto results = bst.searchByCategory(category);
        list out;
        for (const auto &item : results) {
            out.append(dict(
                "id"_a = item.id,
                "name"_a = item.name,
                "category"_a = item.category,
                "price"_a = item.price,
                "quantity"_a = item.quantity
            ));
        }
        return out;
    }

    list get_low_stock(int threshold) const {
        auto results = bst.getLowStockItems(threshold);
        list out;
        for (const auto &item : results) {
            out.append(dict(
                "id"_a = item.id,
                "name"_a = item.name,
                "category"_a = item.category,
                "price"_a = item.price,
                "quantity"_a = item.quantity
            ));
        }
        return out;
    }

    dict get_tree_info() const {
        vector<dict> nodes_with_balance;
        inOrderWithBalance(bst.getRoot(), nodes_with_balance, 0);
        
        list nodes;
        int well_balanced_count = 0;
        double total_balance = 0;
        
        for (const auto& node : nodes_with_balance) {
            nodes.append(node);
            int balance = node["balance"].cast<int>();
            if (abs(balance) <= 1) well_balanced_count++;
            total_balance += abs(balance);
        }
        
        double balance_quality = nodes_with_balance.empty() ? 100.0 : 
            (well_balanced_count * 100.0) / nodes_with_balance.size();
        double avg_balance = nodes_with_balance.empty() ? 0.0 : total_balance / nodes_with_balance.size();
        
        return dict(
            "nodes"_a = nodes,
            "count"_a = static_cast<int>(nodes_with_balance.size()),
            "height"_a = bst.getTreeHeight(),
            "balance_quality"_a = balance_quality,
            "avg_balance"_a = avg_balance,
            "well_balanced_nodes"_a = well_balanced_count,
            "is_avl_balanced"_a = (balance_quality > 95.0)
        );
    }
    
    // Helper to get root for internal use
    BSTNode* getRoot() const { 
        return bst.getRoot(); 
    }
};

PYBIND11_MODULE(inventory_core, m) {
    m.doc() = "High-performance Inventory Management Core";
    
    class_<PyInventoryManager>(m, "InventoryManager")
        .def(init<>())
        .def("add_item", &PyInventoryManager::add_item)
        .def("remove_item", &PyInventoryManager::remove_item)
        .def("get_item", &PyInventoryManager::get_item)
        .def("get_all_items", &PyInventoryManager::get_all_items)
        .def("get_statistics", &PyInventoryManager::get_statistics)
        .def("update_item", &PyInventoryManager::update_item)
        .def("search_by_name", &PyInventoryManager::search_by_name)
        .def("search_by_category", &PyInventoryManager::search_by_category)
        .def("get_low_stock", &PyInventoryManager::get_low_stock)
        .def("get_tree_info", &PyInventoryManager::get_tree_info)
        .def("get_tree_visualization", &PyInventoryManager::get_tree_visualization)
        .def("get_tree_hierarchy", &PyInventoryManager::get_tree_hierarchy);
}