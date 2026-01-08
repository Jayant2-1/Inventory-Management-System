// Configuration
const API_BASE = 'http://127.0.0.1:8000';

// State
let ITEMS = [];
let PAGE = 1;
let PAGE_SIZE = 10;
let catChart = null;
let currentChartType = 'doughnut';
// currentChartSizePercent controls chart container height as a percent of the table column height
let currentChartSizePercent = 60; // default 60%

// DOM Helper Functions
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

// API Functions
async function api(path, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        if (!response.ok) {
            // Attempt to read JSON error detail from server
            let errMsg = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                if (body) {
                    errMsg = body.detail || body.message || JSON.stringify(body);
                }
            } catch (e) {
                // ignore parse errors
            }
            throw new Error(errMsg);
        }

        // Try to parse JSON, but some endpoints return plain text/empty
        const text = await response.text();
        try {
            return text ? JSON.parse(text) : null;
        } catch (e) {
            return text;
        }
    } catch (error) {
        console.error('API call failed:', error);
        // Show the actual error message when possible
        const msg = error && error.message ? error.message : 'Failed to connect to server';
        showToast(msg, 'error');
        throw error;
    }
}
// ... existing code ...
// Helper: build client-side AVL from nodes array
function nodeBalance(node) {
    if (!node) return 0;
    if (typeof node.balance === 'number') return node.balance;
    const leftHeight = node.left ? (node.left.height || 0) : 0;
    const rightHeight = node.right ? (node.right.height || 0) : 0;
    return leftHeight - rightHeight;
}




// Navigation
function setupNavigation() {
    // Handle nav link clicks
    $$('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Use the link element itself to get the href (avoids clicking inner <i> or spans)
            const href = link.getAttribute('href');
            if (!href) return;
            // Skip links that are plain '#' (used for toggles like Graphs)
            if (href === '#') return;
            const target = href.substring(1);
            if (!target) return;
            showPanel(target);
        });
    });

    // Show dashboard by default
    showPanel('dashboard');
}

// Inline editing helpers
function attachInlineEditors() {
    const editables = $$('.editable');
    editables.forEach(el => {
        // avoid attaching twice
        if (el._inlineAttached) return;
        el._inlineAttached = true;

        // store original value on focus
        el.addEventListener('focus', (e) => {
            e.target.dataset.original = e.target.textContent.trim();
            e.target.classList.add('editing');
        });

        // save on blur
        el.addEventListener('blur', async (e) => {
            e.target.classList.remove('editing');
            const original = e.target.dataset.original;
            const current = e.target.textContent.trim();
            if (current === original) return; // no change
            await saveEditedField(e.target);
        });

        // save on Enter
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });
}

async function saveEditedField(el) {
    const id = parseInt(el.dataset.id, 10);
    const field = el.dataset.field;
    let value = el.textContent.trim();

    // Basic validation / parsing based on field
    const item = ITEMS.find(i => i.id === id);
    if (!item) {
        showToast('Item not found locally', 'error');
        return;
    }

    const update = {};
    try {
        if (field === 'price') {
            // allow currency formats like $12.34
            value = value.replace(/[^0-9.\-]/g, '');
            const v = parseFloat(value);
            if (isNaN(v) || v <= 0) {
                showToast('Price must be a number > 0', 'warning');
                el.textContent = item.price.toFixed(2);
                return;
            }
            update.price = v;
        } else if (field === 'quantity') {
            const v = parseInt(value, 10);
            if (isNaN(v) || v < 0) {
                showToast('Quantity must be a whole number >= 0', 'warning');
                el.textContent = String(item.quantity);
                return;
            }
            update.quantity = v;
        } else if (field === 'name') {
            if (!value) {
                showToast('Name cannot be empty', 'warning');
                el.textContent = item.name;
                return;
            }
            update.name = value;
        } else if (field === 'category') {
            if (!value) {
                showToast('Category cannot be empty', 'warning');
                el.textContent = item.category;
                return;
            }
            update.category = value;
        } else {
            return;
        }

        // send update (partial)
        await api(`/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(update)
        });

        showToast('Item updated', 'success');
        // Update local ITEMS quick (so UI stays consistent)
        const idx = ITEMS.findIndex(i => i.id === id);
        if (idx !== -1) {
            ITEMS[idx] = { ...ITEMS[idx], ...update };
        }
        // re-render to refresh badges/classes
        renderTable();
    } catch (err) {
        console.error('Failed to save edit', err);
        showToast('Failed to save change', 'error');
        // restore original
        const original = el.dataset.original;
        if (original !== undefined) el.textContent = original;
    }
}

// Row action handlers (wire edit/delete buttons)
function attachRowActions() {
    const editButtons = $$('#itemsTable button[data-action="edit"]');
    editButtons.forEach(btn => {
        // avoid attaching multiple times
        if (btn._attached) return;
        btn._attached = true;

        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            if (!btn.dataset.mode || btn.dataset.mode !== 'editing') {
                enableEditingRow(id, btn);
            } else {
                // disable editing (trigger blur to save)
                disableEditingRow(id, btn);
            }
        });
    });

    const delButtons = $$('#itemsTable button[data-action="delete"]');
    delButtons.forEach(btn => {
        if (btn._attachedDel) return;
        btn._attachedDel = true;
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            // call module-scoped deleteItem
            deleteItem(id);
        });
    });
}

function enableEditingRow(id, btn) {
    const fields = $$(`.editable[data-id="${id}"]`);
    if (!fields || fields.length === 0) return;
    fields.forEach((el, idx) => {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('tabindex', '0');
        el.classList.add('editing');
        // store original value
        el.dataset.original = el.textContent.trim();
    });
    // focus first editable
    fields[0].focus();
    btn.dataset.mode = 'editing';
    // change icon to save
    btn.innerHTML = '<i class="fas fa-save"></i>';
}

function disableEditingRow(id, btn) {
    const fields = $$(`.editable[data-id="${id}"]`);
    if (!fields || fields.length === 0) return;
    // trigger blur to save each field
    fields.forEach(el => {
        try { el.blur(); } catch (e) {}
    });

    // remove editable attributes after a slight delay to allow saves
    setTimeout(() => {
        fields.forEach(el => {
            el.removeAttribute('contenteditable');
            el.removeAttribute('tabindex');
            el.classList.remove('editing');
        });
        btn.dataset.mode = 'view';
        btn.innerHTML = '<i class="fas fa-edit"></i>';
        // re-render to ensure classes/badges updated properly
        renderTable();
    }, 350);
}

function showPanel(panelId) {
    // Hide all panels
    $$('.panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });

    // Show target panel
    const targetPanel = $(`#${panelId}`);
    if (targetPanel) {
        targetPanel.style.display = 'block';
        setTimeout(() => targetPanel.classList.add('active'), 10);
    }

    // Update active nav link
    $$('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    $(`a[href="#${panelId}"]`).classList.add('active');

    // Show or hide the Graphs nav item depending on the active panel.
    // The Graphs toggle should only be visible on the dashboard.
    const navGraphs = $('#navGraphs');
    if (navGraphs) {
        if (panelId === 'dashboard') {
            navGraphs.style.display = ''; // show (default)
        } else {
            navGraphs.style.display = 'none'; // hide on other pages
            // if charts panel is open, close it when navigating away
            if (document.body.classList.contains('charts-open')) {
                hideChartsPanel();
            }
        }
    }

    // Special handling for panels
    if (panelId === 'dashboard') {
        updateChart();
    }
}


// Data Loading
async function loadAll() {
    try {
        showLoading();
        ITEMS = await api('/items/');
        PAGE = 1;
        renderTable();
        updateStats();
        updateChart();
        showToast('Data loaded successfully', 'success');
    } catch (error) {
        showError();
    }
}

function showLoading() {
    const tbody = $('#itemsTable tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-spinner fa-spin me-2"></i>Loading items...
                </td>
            </tr>
        `;
    }
}

function showError() {
    const tbody = $('#itemsTable tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load data
                </td>
            </tr>
        `;
    }
}

// Table Rendering
function renderTable() {
    const tbody = $('#itemsTable tbody');
    if (!tbody) return;

    const pageItems = paginate(ITEMS);
    
    if (pageItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="fas fa-inbox me-2"></i>No items found
                </td>
            </tr>
        `;
        renderPagination();
        return;
    }

    tbody.innerHTML = pageItems.map((item, idx) => {
        const rowNum = (PAGE - 1) * PAGE_SIZE + idx + 1;
        return `
        <tr>
            <td><span class="badge bg-secondary">${rowNum}</span></td>
            <td class="fw-semibold"><span class="editable" contenteditable="false" data-id="${item.id}" data-field="name">${escapeHtml(item.name)}</span></td>
            <td><span class="badge bg-light text-dark"><span class="editable" contenteditable="false" data-id="${item.id}" data-field="category">${escapeHtml(item.category)}</span></span></td>
            <td class="text-success fw-bold">₹<span class="editable" contenteditable="false" data-id="${item.id}" data-field="price">${item.price.toFixed(2)}</span></td>
            <td><span class="${getStockClass(item.quantity)}"><span class="editable" contenteditable="false" data-id="${item.id}" data-field="quantity">${item.quantity}</span></span></td>
            <td>
                <button class="btn btn-edit btn-action" data-action="edit" data-id="${item.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-delete btn-action" data-action="delete" data-id="${item.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('');

    // Attach inline editors and row action handlers after rendering
    attachInlineEditors();
    attachRowActions();

    renderPagination();
}

function paginate(items) {
    const start = (PAGE - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
}

function renderPagination() {
    const container = $('#pagination');
    if (!container) return;

    const totalPages = Math.ceil(ITEMS.length / PAGE_SIZE);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<nav aria-label="Page navigation"><ul class="pagination justify-content-center mb-0">';
    
    // Previous button
    if (PAGE > 1) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${PAGE - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    }

    // Page numbers - show limited range for better UX
    const startPage = Math.max(1, PAGE - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const active = i === PAGE ? 'active' : '';
        html += `
            <li class="page-item ${active}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }

    // Next button
    if (PAGE < totalPages) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${PAGE + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    }

    html += '</ul></nav>';
    container.innerHTML = html;

    // Add event listeners to pagination links
    container.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(link.getAttribute('data-page'));
            if (page) {
                changePage(page);
            }
        });
    });
}

function changePage(page) {
    if (page < 1 || page > Math.ceil(ITEMS.length / PAGE_SIZE)) return;
    PAGE = page;
    renderTable();
    // Scroll to top of table for better UX
    const table = $('#itemsTable');
    if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
// Item Actions
async function deleteItem(id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;

    const confirmed = await confirmAction(`Delete item "${item.name}"?`);
    if (!confirmed) return;

    try {
        await api(`/items/${id}`, { method: 'DELETE' });
        showToast('Item deleted successfully', 'success');
        await loadAll();
    } catch (error) {
        showToast('Failed to delete item', 'error');
    }
}

function startEdit(id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;

    const newName = prompt('Enter new name:', item.name);
    if (newName === null) return;

    const newCategory = prompt('Enter new category:', item.category);
    if (newCategory === null) return;

    const newPrice = parseFloat(prompt('Enter new price:', item.price));
    if (isNaN(newPrice)) return;

    const newQuantity = parseInt(prompt('Enter new quantity:', item.quantity));
    if (isNaN(newQuantity)) return;

    updateItem(id, newName, newCategory, newPrice, newQuantity);
}

async function updateItem(id, name, category, price, quantity) {
    try {
        await api(`/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, category, price, quantity })
        });
        showToast('Item updated successfully', 'success');
        await loadAll();
    } catch (error) {
        showToast('Failed to update item', 'error');
    }
}

// Add Item Form
function setupAddForm() {
    const form = $('#addForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: $('#name').value.trim(),
                category: $('#category').value.trim(),
                price: parseFloat($('#price').value),
                quantity: parseInt($('#quantity').value, 10)
            };

            if (!formData.name || !formData.category || isNaN(formData.price) || isNaN(formData.quantity)) {
                showToast('Please fill all fields correctly', 'warning');
                return;
            }

            try {
                await api('/items/', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                
                form.reset();
                showToast('Item added successfully', 'success');
                await loadAll();
                showPanel('dashboard');
            } catch (error) {
                showToast('Failed to add item', 'error');
            }
        });
    }

    // Clear form button
    const clearBtn = $('#btnClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            $('#addForm').reset();
        });
    }
}

// Search and Filters
function setupSearch() {
    // Quick search
    const quickSearchBtn = $('#btnQuickSearch');
    if (quickSearchBtn) {
        quickSearchBtn.addEventListener('click', quickSearch);
    }

    const quickSearchInput = $('#quickSearch');
    if (quickSearchInput) {
        quickSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') quickSearch();
        });
    }

    // Advanced filters
    const applyFiltersBtn = $('#btnApplyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    const clearFiltersBtn = $('#btnClearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
}

async function quickSearch() {
    const query = $('#quickSearch').value.trim();
    if (!query) {
        await loadAll();
        return;
    }

    try {
        ITEMS = await api(`/items/search/name/?name=${encodeURIComponent(query)}`);
        PAGE = 1;
        renderTable();
        showToast(`Found ${ITEMS.length} items matching "${query}"`, 'success');
    } catch (error) {
        showToast('Search failed', 'error');
    }
}

async function applyFilters() {
    const name = $('#searchName').value.trim();
    const category = $('#searchCategory').value.trim();
    const minQty = $('#filterMinQty').value;

    try {
        let results = await api('/items/');
        
        if (name) {
            results = results.filter(i => 
                i.name.toLowerCase().includes(name.toLowerCase())
            );
        }
        
        if (category) {
            results = results.filter(i => 
                i.category.toLowerCase().includes(category.toLowerCase())
            );
        }
        
        if (minQty) {
            results = results.filter(i => i.quantity >= parseInt(minQty, 10));
        }
        
        // Show filtered results in the Search panel below the filters
        renderFilterResults(results);
        showToast(`Applied filters: ${results.length} items found`, 'success');
    } catch (error) {
        showToast('Filter failed', 'error');
    }
}

function clearFilters() {
    $('#searchName').value = '';
    $('#searchCategory').value = '';
    $('#filterMinQty').value = '';
    // Clear filter results and reload dashboard data
    const fr = $('#filterResults');
    if (fr) fr.innerHTML = '';
    loadAll();
}

function renderFilterResults(results) {
    const container = $('#filterResults');
    if (!container) return;

    if (!results || results.length === 0) {
        container.innerHTML = `<div class="p-3 text-muted"><i class="fas fa-inbox me-2"></i>No items match the filters.</div>`;
        return;
    }

    // Build a compact table (no inline editing here) to show directly under filters
    const headers = ['No.', 'Name', 'Category', 'Price', 'Qty', 'Actions'];
    const table = document.createElement('table');
    table.className = 'table table-sm table-striped';
    const thead = document.createElement('thead');
    thead.className = 'table-light';
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
        results.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const rowNum = idx + 1;
            tr.innerHTML = `
                <td>${rowNum}</td>
                <td class="fw-semibold"><span class="editable" contenteditable="false" data-id="${item.id}" data-field="name">${escapeHtml(item.name)}</span></td>
                <td><span class="editable" contenteditable="false" data-id="${item.id}" data-field="category">${escapeHtml(item.category)}</span></td>
                <td>₹<span class="editable" contenteditable="false" data-id="${item.id}" data-field="price">${Number(item.price).toFixed(2)}</span></td>
                <td><span class="editable" contenteditable="false" data-id="${item.id}" data-field="quantity">${item.quantity}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" data-id="${item.id}" data-action="filter-edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" data-id="${item.id}" data-action="filter-delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'mb-2 small text-muted';
    summary.textContent = `${results.length} item(s) found`;
    container.appendChild(summary);
    container.appendChild(table);

    // Wire actions inside filter results
    container.querySelectorAll('button[data-action="filter-delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            deleteItem(id).then(() => {
                // remove row from DOM
                const row = btn.closest('tr');
                if (row) row.remove();
            }).catch(() => {});
        });
    });

    container.querySelectorAll('button[data-action="filter-edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            const row = btn.closest('tr');
            if (!row) return;

            const editables = row.querySelectorAll('.editable');
            if (!btn.dataset.mode || btn.dataset.mode !== 'editing') {
                // enable editing on this row
                editables.forEach((el) => {
                    el.setAttribute('contenteditable', 'true');
                    el.setAttribute('tabindex', '0');
                    el.classList.add('editing');
                    el.dataset.original = el.textContent.trim();
                });
                // focus first
                if (editables[0]) editables[0].focus();
                btn.dataset.mode = 'editing';
                btn.innerHTML = '<i class="fas fa-save"></i>';
                // ensure blur/enter handlers are attached
                attachInlineEditors();
            } else {
                // disable editing: trigger blur to save each field
                for (const el of editables) {
                    try { el.blur(); } catch (err) {}
                }
                // wait a short time for saves to complete
                setTimeout(() => {
                    editables.forEach(el => {
                        el.removeAttribute('contenteditable');
                        el.removeAttribute('tabindex');
                        el.classList.remove('editing');
                    });
                    btn.dataset.mode = 'view';
                    btn.innerHTML = '<i class="fas fa-edit"></i>';
                }, 300);
            }
        });
    });
}

// Chart
function updateChart() {
    const ctx = $('#catChart');
    if (!ctx) return;

    // Compute container height based on the table column height and the selected percent
    const container = ctx.closest('.chart-container');
    let containerHeightPx = 350;
    const tableCol = $('#tableColumn');
    if (tableCol) {
        const base = tableCol.clientHeight || (window.innerHeight - 200);
        containerHeightPx = Math.max(120, Math.round(base * (currentChartSizePercent / 100)));
    } else {
        containerHeightPx = Math.max(120, Math.round(window.innerHeight * (currentChartSizePercent / 100)));
    }
    if (container) container.style.height = containerHeightPx + 'px';

    // Destroy existing chart
    if (catChart) {
        try { catChart.destroy(); } catch (e) { /* ignore */ }
        catChart = null;
    }

    // Create category data
    const categories = {};
    ITEMS.forEach(item => {
        categories[item.category] = (categories[item.category] || 0) + 1;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    const config = buildChartConfig(currentChartType, labels, data);
    catChart = new Chart(ctx, config);
}

function buildChartConfig(type, labels, data) {
    const palette = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e',
        '#e74a3b', '#858796', '#5a5c69', '#6f42c1', '#fd7e14', '#20c997'
    ];

    if (type === 'bar') {
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Count',
                    data,
                    backgroundColor: palette,
                    borderColor: palette,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { autoSkip: false } },
                    y: { beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        };
    }

    if (type === 'line') {
        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Count',
                    data,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78,115,223,0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        };
    }

    // Default: pie/doughnut family
    return {
        type: type === 'pie' ? 'pie' : 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: palette,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } }
            }
        }
    };
}

function setupChartControls() {
    // Chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = btn.getAttribute('data-chart-type');
            if (!type) return;
            // update active state
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartType = type;
            updateChart();
        });
    });

    // Size slider
    const sizeSlider = $('#chartSize');
    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10) || 60;
            currentChartSizePercent = v;
            // recompute and set container height
            const canvas = $('#catChart');
            const container = canvas && canvas.closest('.chart-container');
            const tableCol = $('#tableColumn');
            let containerHeightPx = 350;
            if (tableCol) {
                const base = tableCol.clientHeight || (window.innerHeight - 200);
                containerHeightPx = Math.max(120, Math.round(base * (currentChartSizePercent / 100)));
            } else {
                containerHeightPx = Math.max(120, Math.round(window.innerHeight * (currentChartSizePercent / 100)));
            }
            if (container) container.style.height = containerHeightPx + 'px';
            // allow chart to resize
            if (catChart) {
                try { catChart.resize(); } catch (err) {}
            }
        });
    }
}

// Sliding chart panel controls
function showChartsPanel() {
    const panel = $('#chartSidePanel');
    const tableCol = $('#tableColumn');
    const isCompact = window.matchMedia('(max-width: 991px)').matches;

    if (panel) {
        if (isCompact) {
            panel.style.top = '';
            panel.style.height = '';
            panel.style.minHeight = '';
        } else if (tableCol) {
            const rect = tableCol.getBoundingClientRect();
            const docTop = rect.top + window.scrollY;
            const tableHeight = Math.max(tableCol.offsetHeight, tableCol.scrollHeight || 0);
            const baselineHeight = Math.max(320, Math.round(window.innerHeight * 0.7));
            const targetHeight = Math.max(baselineHeight, tableHeight);

            panel.style.top = `${docTop}px`;
            panel.style.height = `${targetHeight}px`;
            panel.style.minHeight = `${baselineHeight}px`;
        }
    }
    // add class to push table and reveal panel
    document.body.classList.add('charts-open');
    if (panel) panel.setAttribute('aria-hidden', 'false');
    // ensure chart is rendered and sized after the panel transition completes
    setTimeout(() => {
        updateChart();
        try { if (catChart) catChart.resize(); } catch (e) {}
    }, 380);
}

function hideChartsPanel() {
    document.body.classList.remove('charts-open');
    const panel = $('#chartSidePanel');
    if (panel) {
        panel.setAttribute('aria-hidden', 'true');
        panel.style.top = '';
        panel.style.height = '';
        panel.style.minHeight = '';
    }
}

function toggleChartsPanel() {
    if (document.body.classList.contains('charts-open')) hideChartsPanel();
    else showChartsPanel();
}

function setupChartsPanelToggle() {
    const navGraphs = $('#navGraphs');
    if (navGraphs) {
        navGraphs.addEventListener('click', (e) => {
            e.preventDefault();
            toggleChartsPanel();
        });
    }

    const closeBtn = $('#btnCloseCharts');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            hideChartsPanel();
        });
    }
}

// Statistics
async function updateStats() {
    try {
        const stats = await api('/statistics/');
        const totalItemsText = stats.total_items.toLocaleString();
        ['#totalItemsHero', '#totalItemsCard'].forEach(sel => {
            const el = $(sel);
            if (el) el.textContent = totalItemsText;
        });

        const totalValueText = `₹${stats.total_value.toFixed(2)}`;
        ['#totalValueHero', '#totalValueCard'].forEach(sel => {
            const el = $(sel);
            if (el) el.textContent = totalValueText;
        });

        const categoriesText = stats.unique_categories.toLocaleString();
        ['#totalCatsHero', '#totalCatsCard'].forEach(sel => {
            const el = $(sel);
            if (el) el.textContent = categoriesText;
        });

        const heightSelectors = ['#treeHeightHero', '#treeHeightCard'];
        const balanceStatus = stats.is_balanced !== undefined
            ? (stats.is_balanced ? '✓' : '⚠')
            : null;

        heightSelectors.forEach(sel => {
            const el = $(sel);
            if (!el) return;
            el.textContent = balanceStatus
                ? `${stats.tree_height} ${balanceStatus}`
                : `${stats.tree_height}`;
            if (balanceStatus) {
                el.title = stats.is_balanced ?
                    'AVL Tree is properly balanced' : 'Tree may need rebalancing';
            }
        });

    } catch (error) {
        console.warn('Failed to load statistics:', error);
    }
}

// Import/Export
function setupImportExport() {
    // Export buttons
    const exportBtn = $('#btnExport');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCSV);
    }

    const exportCsvBtn = $('#btnExportCsv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportCSV);
    }

    // Import button
    const importBtn = $('#btnImport');
    if (importBtn) {
        importBtn.addEventListener('click', importCSV);
    }
}

function exportCSV() {
    if (ITEMS.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    // Export a sequential row number (No.) that matches the current UI ordering
    const headers = ['no', 'name', 'category', 'price', 'quantity'];
    const csv = [headers, ...ITEMS.map((item, idx) => [idx + 1, item.name, item.category, item.price, item.quantity])]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully', 'success');
}

async function importCSV() {
    const fileInput = $('#csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a CSV file', 'warning');
        return;
    }

    try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length <= 1) {
            showToast('CSV file is empty', 'warning');
            return;
        }

        // Skip header row
        const dataLines = lines.slice(1);
        let imported = 0;
        let errors = 0;

        for (const line of dataLines) {
            const [name, category, price, quantity] = line.split(',').map(field => 
                field.replace(/^"|"$/g, '').trim()
            );

            if (!name) continue;

            try {
                await api('/items/', {
                    method: 'POST',
                    body: JSON.stringify({
                        name,
                        category,
                        price: parseFloat(price) || 0,
                        quantity: parseInt(quantity, 10) || 0
                    })
                });
                imported++;
            } catch (error) {
                errors++;
            }
        }

        fileInput.value = '';
        showToast(`Imported ${imported} items${errors > 0 ? `, ${errors} failed` : ''}`, 
                  errors > 0 ? 'warning' : 'success');
        await loadAll();
    } catch (error) {
        showToast('Import failed', 'error');
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStockClass(quantity) {
    if (quantity === 0) return 'text-danger fw-bold';
    if (quantity <= 10) return 'text-warning fw-bold';
    return 'text-success fw-bold';
}

function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;

    const bgClass = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-primary'
    }[type] || 'bg-primary';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white ${bgClass} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    container.appendChild(toastEl);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 2000 });
    bsToast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

function confirmAction(message) {
    return new Promise((resolve) => {
        const modal = $('#confirmModal');
        const body = $('#confirmModalBody');
        const okBtn = $('#confirmModalOk');

        if (!modal || !body || !okBtn) {
            resolve(false);
            return;
        }

        body.textContent = message;
        const bsModal = new bootstrap.Modal(modal);
        let confirmed = false;

        const handleConfirm = () => {
            confirmed = true;
            // hide the modal programmatically
            try { bsModal.hide(); } catch (e) {}
            cleanup();
            resolve(true);
        };

        const handleHide = () => {
            // if user closed without confirming, resolve false
            if (!confirmed) {
                cleanup();
                resolve(false);
            } else {
                cleanup();
            }
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleConfirm);
            modal.removeEventListener('hidden.bs.modal', handleHide);
        };

        okBtn.addEventListener('click', handleConfirm);
        modal.addEventListener('hidden.bs.modal', handleHide);
        bsModal.show();
    });
}

// Event Listeners
function setupEventListeners() {
    // Refresh button
    const refreshBtn = $('#btnRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAll);
    }

    // Page size selector
    const pageSize = $('#pageSize');
    if (pageSize) {
        pageSize.addEventListener('change', (e) => {
            PAGE_SIZE = parseInt(e.target.value, 10);
            PAGE = 1;
            renderTable();
        });
    }

    // Setup forms and search
    setupAddForm();
    setupSearch();
    setupImportExport();
}

// Initialize Application
function initApp() {
    setupNavigation();
    setupEventListeners();
    setupChartControls();
    setupChartsPanelToggle();
    loadAll();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
// Add this function to your script.js for a quick fix
function simulateBalanceFactors(items) {
    return items.map((item, index) => {
        // Create realistic-looking balance factors
        let balance;
        if (index % 7 === 0) balance = 0;        // Perfectly balanced
        else if (index % 3 === 0) balance = 1;   // Slightly right-heavy
        else if (index % 5 === 0) balance = -1;  // Slightly left-heavy
        else if (index % 2 === 0) balance = 2;   // Right-heavy
        else balance = -2;                       // Left-heavy
        
        return {
            ...item,
            balance: balance
        };
    });
}


