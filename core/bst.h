#ifndef BST_H
#define BST_H

#include <string>
#include <memory>
#include <vector>
#include <functional>
using namespace std;
struct Item {
    int id;
    string name;
    string category;
    double price;
    int quantity;
    
    Item(int id, const string& name, const string& category, 
         double price, int quantity)
        : id(id), name(name), category(category), price(price), quantity(quantity) {}
};

class BSTNode {
public:
    Item data;
    unique_ptr<BSTNode> left;
    unique_ptr<BSTNode> right;
    int height;
    
    BSTNode(const Item& item) 
        : data(item), left(nullptr), right(nullptr), height(1) {}
};

class InventoryBST {
private:
    unique_ptr<BSTNode> root;
    
    unique_ptr<BSTNode> insertHelper(unique_ptr<BSTNode> node, const Item& item);
    BSTNode* searchHelper(BSTNode* node, int id) const;
    unique_ptr<BSTNode> deleteHelper(unique_ptr<BSTNode> node, int id);
    BSTNode* findMin(BSTNode* node) const;
    int getHeight(BSTNode* node) const;
    void updateHeight(BSTNode* node) const;
    int getBalance(BSTNode* node) const;
    unique_ptr<BSTNode> rightRotate(unique_ptr<BSTNode> y);
    unique_ptr<BSTNode> leftRotate(unique_ptr<BSTNode> x);
    void inOrderHelper(BSTNode* node, function<void(const Item&)> callback) const;
    
public:
    InventoryBST() = default;
    
    void insert(const Item& item);
    bool remove(int id);
    Item* search(int id) const;
    bool update(const Item& newData);
    
    vector<Item> getAllItems() const;
    vector<Item> searchByName(const string& name) const;
    vector<Item> searchByCategory(const string& category) const;
    vector<Item> getLowStockItems(int threshold) const;
    
    double getTotalValue() const;
    int getTreeHeight() const;
    size_t getItemCount() const;
    BSTNode* getRoot() const { return root.get(); }
};

#endif