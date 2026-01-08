#include "bst.h"
#include <algorithm>
#include <iostream>
using namespace std;
unique_ptr<BSTNode> InventoryBST::insertHelper(unique_ptr<BSTNode> node, const Item& item) {
    // Standard BST insert
    if (!node) {
        return make_unique<BSTNode>(item);
    }

    if (item.id < node->data.id) {
        node->left = insertHelper(move(node->left), item);
    } else if (item.id > node->data.id) {
        node->right = insertHelper(move(node->right), item);
    } else {
        // equal ids: replace data
        node->data = item;
        return node;
    }

    // Update height and rebalance (AVL)
    updateHeight(node.get());
    int balance = getBalance(node.get());

    // Left Left
    if (balance > 1 && item.id < node->left->data.id) {
        return rightRotate(move(node));
    }

    // Right Right
    if (balance < -1 && item.id > node->right->data.id) {
        return leftRotate(move(node));
    }

    // Left Right
    if (balance > 1 && item.id > node->left->data.id) {
        node->left = leftRotate(move(node->left));
        return rightRotate(move(node));
    }

    // Right Left
    if (balance < -1 && item.id < node->right->data.id) {
        node->right = rightRotate(move(node->right));
        return leftRotate(move(node));
    }

    return node;
}

void InventoryBST::insert(const Item& item) {
    root = insertHelper(move(root), item);
}

BSTNode* InventoryBST::searchHelper(BSTNode* node, int id) const {
    while (node && node->data.id != id) {
        if (id < node->data.id) {
            node = node->left.get();
        } else {
            node = node->right.get();
        }
    }
    return node;
}

Item* InventoryBST::search(int id) const {
    BSTNode* result = searchHelper(root.get(), id);
    return result ? &result->data : nullptr;
}

void InventoryBST::inOrderHelper(BSTNode* node, function<void(const Item&)> callback) const {
    if (!node) return;
    
    inOrderHelper(node->left.get(), callback);
    callback(node->data);
    inOrderHelper(node->right.get(), callback);
}

vector<Item> InventoryBST::getAllItems() const {
    vector<Item> items;
    inOrderHelper(root.get(), [&](const Item& item) {
        items.push_back(item);
    });
    return items;
}

vector<Item> InventoryBST::searchByName(const string& name) const {
    vector<Item> results;
    inOrderHelper(root.get(), [&](const Item& item) {
        if (item.name.find(name) != string::npos) {
            results.push_back(item);
        }
    });
    return results;
}

vector<Item> InventoryBST::searchByCategory(const string& category) const {
    vector<Item> results;
    inOrderHelper(root.get(), [&](const Item& item) {
        if (item.category == category) {
            results.push_back(item);
        }
    });
    return results;
}

double InventoryBST::getTotalValue() const {
    double total = 0.0;
    inOrderHelper(root.get(), [&](const Item& item) {
        total += item.price * item.quantity;
    });
    return total;
}

int InventoryBST::getTreeHeight() const {
    return root ? root->height : 0;
}

size_t InventoryBST::getItemCount() const {
    size_t count = 0;
    inOrderHelper(root.get(), [&](const Item&) { count++; });
    return count;
}

unique_ptr<BSTNode> InventoryBST::deleteHelper(unique_ptr<BSTNode> node, int id) {
    if (!node) return nullptr;
    
    if (id < node->data.id) {
        node->left = deleteHelper(move(node->left), id);
    } else if (id > node->data.id) {
        node->right = deleteHelper(move(node->right), id);
    } else {
        if (!node->left) return move(node->right);
        if (!node->right) return move(node->left);
        
        BSTNode* minNode = findMin(node->right.get());
        node->data = minNode->data;
        node->right = deleteHelper(move(node->right), minNode->data.id);
    }
    // Update height and rebalance
    updateHeight(node.get());
    int balance = getBalance(node.get());

    // Left Left
    if (balance > 1 && getBalance(node->left.get()) >= 0) {
        return rightRotate(move(node));
    }

    // Left Right
    if (balance > 1 && getBalance(node->left.get()) < 0) {
        node->left = leftRotate(move(node->left));
        return rightRotate(move(node));
    }

    // Right Right
    if (balance < -1 && getBalance(node->right.get()) <= 0) {
        return leftRotate(move(node));
    }

    // Right Left
    if (balance < -1 && getBalance(node->right.get()) > 0) {
        node->right = rightRotate(move(node->right));
        return leftRotate(move(node));
    }

    return node;
}

BSTNode* InventoryBST::findMin(BSTNode* node) const {
    while (node && node->left) node = node->left.get();
    return node;
}

int InventoryBST::getHeight(BSTNode* node) const {
    return node ? node->height : 0;
}

void InventoryBST::updateHeight(BSTNode* node) const {
    if (!node) return;
    int lh = node->left ? node->left->height : 0;
    int rh = node->right ? node->right->height : 0;
    node->height = 1 + max(lh, rh);
}

int InventoryBST::getBalance(BSTNode* node) const {
    if (!node) return 0;
    int lh = node->left ? node->left->height : 0;
    int rh = node->right ? node->right->height : 0;
    return lh - rh;
}

unique_ptr<BSTNode> InventoryBST::rightRotate(unique_ptr<BSTNode> y) {
    unique_ptr<BSTNode> x = move(y->left);
    unique_ptr<BSTNode> T2 = nullptr;
    if (x->right) T2 = move(x->right);

    // Perform rotation
    x->right = move(y);
    x->right->left = move(T2);

    // Update heights
    updateHeight(x->right.get());
    updateHeight(x.get());

    return x;
}

unique_ptr<BSTNode> InventoryBST::leftRotate(unique_ptr<BSTNode> x) {
    unique_ptr<BSTNode> y = move(x->right);
    unique_ptr<BSTNode> T2 = nullptr;
    if (y->left) T2 = move(y->left);

    // Perform rotation
    y->left = move(x);
    y->left->right = move(T2);

    // Update heights
    updateHeight(y->left.get());
    updateHeight(y.get());

    return y;
}

bool InventoryBST::remove(int id) {
    if (!search(id)) return false;
    root = deleteHelper(move(root), id);
    return true;
}

bool InventoryBST::update(const Item& newData) {
    Item* existing = search(newData.id);
    if (!existing) return false;
    *existing = newData;
    return true;
}

vector<Item> InventoryBST::getLowStockItems(int threshold) const {
    vector<Item> results;
    inOrderHelper(root.get(), [&](const Item& item) {
        if (item.quantity <= threshold) {
            results.push_back(item);
        }
    });
    return results;
}