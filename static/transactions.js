// Transactions page JavaScript
let currentGroupId = null;
let allTransactions = [];
let filteredTransactions = [];
let allMembers = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadUserInfo();
        await loadGroups();
        initializeFilters();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing transactions page:', error);
        showError('Failed to load page data');
    }
});

// Load user information
async function loadUserInfo() {
    try {
        const token = localStorage.getItem('access_token');
        console.log('🔍 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'null');
        console.log('🔍 localStorage keys:', Object.keys(localStorage));
        
        if (!token) {
            console.log('❌ No token found, redirecting to login');
            window.location.href = '/';
            return;
        }

        console.log('📡 Making request to /api/me...');
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const user = await response.json();
            console.log('✅ User info loaded:', user);
            document.getElementById('userName').textContent = user.username;
            document.getElementById('userInfo').style.display = 'flex';
        } else {
            const errorText = await response.text();
            console.log('❌ API error response:', errorText);
            throw new Error('Failed to load user info');
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        console.log('🔄 Clearing localStorage and redirecting...');
        localStorage.removeItem('access_token');
        window.location.href = '/';
    }
}

// Load user groups
async function loadGroups() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/groups/', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const groups = await response.json();
            displayGroups(groups);
        } else {
            throw new Error('Failed to load groups');
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        showError('Failed to load groups');
    }
}

// Display groups in sidebar
function displayGroups(groups) {
    const groupsList = document.getElementById('groupsList');
    
    if (groups.length === 0) {
        groupsList.innerHTML = `
            <div class="empty-state">
                <div class="welcome-icon">
                    <i class="fas fa-users"></i>
                </div>
                <h3>No groups yet</h3>
                <p>Create your first group to start tracking expenses</p>
                <button class="action-btn primary" onclick="window.location.href='/'">
                    <i class="fas fa-plus"></i>
                    Create Group
                </button>
            </div>
        `;
        return;
    }

    groupsList.innerHTML = groups.map(group => `
        <div class="group-card ${group.id === currentGroupId ? 'active' : ''}" 
             onclick="selectGroup(${group.id})">
            <div class="group-info">
                <h3 class="group-name">${escapeHtml(group.name)}</h3>
                <div class="group-meta">
                    <span class="member-count">
                        <i class="fas fa-users"></i>
                        ${group.members ? group.members.length : 0} members
                    </span>
                    <span class="expense-count">
                        <i class="fas fa-receipt"></i>
                        0 expenses
                    </span>
                </div>
            </div>
            <div class="group-balance positive">
                $0.00
            </div>
        </div>
    `).join('');
}

// Select a group and load its transactions
async function selectGroup(groupId) {
    try {
        console.log(`🎯 Selecting group ${groupId}...`);
        currentGroupId = groupId;
        
        // Update UI state
        document.getElementById('welcomeState').style.display = 'none';
        document.getElementById('groupTransactions').style.display = 'block';
        
        // Update active group in sidebar
        document.querySelectorAll('.group-card').forEach(card => {
            card.classList.remove('active');
        });
        const selectedCard = document.querySelector(`[onclick="selectGroup(${groupId})"]`);
        if (selectedCard) {
            selectedCard.classList.add('active');
            console.log(`✅ Updated UI for group ${groupId}`);
        }
        
        // Load group data and transactions
        console.log(`📡 Loading data for group ${groupId}...`);
        await Promise.all([
            loadGroupDetails(groupId),
            loadTransactions(groupId),
            loadGroupMembers(groupId)
        ]);
        
        console.log(`✅ Completed loading data for group ${groupId}`);
        
    } catch (error) {
        console.error('❌ Error selecting group:', error);
        showError('Failed to load group data');
    }
}

// Load group details
async function loadGroupDetails(groupId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/groups/${groupId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const group = await response.json();
            document.getElementById('selectedGroupName').innerHTML = `
                <i class="fas fa-history"></i>
                ${escapeHtml(group.name)} - Transactions
            `;
            
            // Set members from group data
            if (group.members) {
                allMembers = group.members;
                updateMemberFilter();
            }
        }
    } catch (error) {
        console.error('Error loading group details:', error);
    }
}

// Load group members (now simplified since we get them from group details)
async function loadGroupMembers(groupId) {
    // Members are loaded as part of loadGroupDetails
    // This function is kept for compatibility but doesn't need to do anything
}

// Update member filter dropdown
function updateMemberFilter() {
    const memberFilter = document.getElementById('memberFilter');
    if (memberFilter) {
        memberFilter.innerHTML = '<option value="">All Members</option>' +
            allMembers.map(member => 
                `<option value="${member.id}">${escapeHtml(member.name || member.username)}</option>`
            ).join('');
    }
}

// Load transactions for a group
async function loadTransactions(groupId) {
    try {
        const token = localStorage.getItem('access_token');
        console.log(`📡 Loading transactions for group ${groupId}...`);
        
        const response = await fetch(`/api/expenses/?group_id=${groupId}&limit=100`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            allTransactions = await response.json();
            console.log('✅ Loaded transactions:', allTransactions);
            console.log(`📊 Total transactions loaded: ${allTransactions.length}`);
            
            filteredTransactions = [...allTransactions];
            updateTransactionStats();
            applyFilters();
        } else {
            const errorText = await response.text();
            console.error('❌ Failed to load transactions, status:', response.status);
            console.error('❌ Error response:', errorText);
            throw new Error('Failed to load transactions');
        }
    } catch (error) {
        console.error('❌ Error loading transactions:', error);
        showError('Failed to load transactions');
    }
}

// Update transaction statistics
function updateTransactionStats() {
    const transactionCount = allTransactions.length;
    const totalAmount = allTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    // Calculate user's share (simplified - you may need to adjust based on your data structure)
    const currentUserId = getCurrentUserId();
    const userShare = allTransactions
        .filter(tx => tx.paid_by === currentUserId)
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

    // Update main stats
    const transactionCountEl = document.getElementById('transactionCount');
    const totalAmountEl = document.getElementById('totalAmount');
    
    if (transactionCountEl) {
        transactionCountEl.textContent = `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`;
    }
    if (totalAmountEl) {
        totalAmountEl.textContent = `$${totalAmount.toFixed(2)} total`;
    }

    // Calculate time-based stats
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weeklyTransactions = allTransactions.filter(tx => new Date(tx.date || tx.created_at) >= weekStart);
    const monthlyTransactions = allTransactions.filter(tx => new Date(tx.date || tx.created_at) >= monthStart);

    const weeklyTotalEl = document.getElementById('weeklyTotal');
    const weeklyCountEl = document.getElementById('weeklyCount');
    const monthlyTotalEl = document.getElementById('monthlyTotal');
    const monthlyCountEl = document.getElementById('monthlyCount');
    const userShareEl = document.getElementById('userShare');

    if (weeklyTotalEl) {
        weeklyTotalEl.textContent = `$${weeklyTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0).toFixed(2)}`;
    }
    if (weeklyCountEl) {
        weeklyCountEl.textContent = `${weeklyTransactions.length} transaction${weeklyTransactions.length !== 1 ? 's' : ''}`;
    }
    if (monthlyTotalEl) {
        monthlyTotalEl.textContent = `$${monthlyTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0).toFixed(2)}`;
    }
    if (monthlyCountEl) {
        monthlyCountEl.textContent = `${monthlyTransactions.length} transaction${monthlyTransactions.length !== 1 ? 's' : ''}`;
    }
    if (userShareEl) {
        userShareEl.textContent = `$${userShare.toFixed(2)}`;
    }
}

// Get current user ID (you'll need to implement this based on your auth system)
function getCurrentUserId() {
    // This is a placeholder - implement based on your user system
    return parseInt(localStorage.getItem('userId')) || 0;
}

// Apply filters and display transactions
function applyFilters() {
    let filtered = [...allTransactions];
    
    // Search filter
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filtered = filtered.filter(tx => 
            (tx.description || '').toLowerCase().includes(searchTerm) ||
            (tx.category || '').toLowerCase().includes(searchTerm) ||
            (tx.payer_name && tx.payer_name.toLowerCase().includes(searchTerm))
        );
    }
    
    // Category filter
    const categoryFilterEl = document.getElementById('categoryFilter');
    const categoryFilter = categoryFilterEl ? categoryFilterEl.value : '';
    if (categoryFilter) {
        filtered = filtered.filter(tx => tx.category === categoryFilter);
    }
    
    // Date filter
    const dateFilterEl = document.getElementById('dateFilter');
    const dateFilter = dateFilterEl ? dateFilterEl.value : 'all';
    if (dateFilter !== 'all') {
        const now = new Date();
        let filterDate;
        
        switch (dateFilter) {
            case 'today':
                filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                filterDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'quarter':
                filterDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                break;
        }
        
        if (filterDate) {
            filtered = filtered.filter(tx => new Date(tx.date || tx.created_at) >= filterDate);
        }
    }
    
    // Member filter
    const memberFilterEl = document.getElementById('memberFilter');
    const memberFilter = memberFilterEl ? memberFilterEl.value : '';
    if (memberFilter) {
        filtered = filtered.filter(tx => tx.paid_by === parseInt(memberFilter));
    }
    
    // Sort
    const sortByEl = document.getElementById('sortBy');
    const sortBy = sortByEl ? sortByEl.value : 'date_desc';
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date_desc':
                return new Date(b.date || b.created_at) - new Date(a.date || a.created_at);
            case 'date_asc':
                return new Date(a.date || a.created_at) - new Date(b.date || b.created_at);
            case 'amount_desc':
                return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
            case 'amount_asc':
                return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
            case 'category':
                return (a.category || '').localeCompare(b.category || '');
            default:
                return 0;
        }
    });
    
    filteredTransactions = filtered;
    displayTransactions();
}

// Display transactions
function displayTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) {
        console.error('❌ Transaction container not found!');
        return;
    }
    
    console.log('🎨 Displaying transactions...');
    console.log(`📊 Filtered transactions count: ${filteredTransactions.length}`);
    console.log('📊 Filtered transactions data:', filteredTransactions);
    
    if (filteredTransactions.length === 0) {
        console.log('📭 No transactions to display, showing empty state');
        container.innerHTML = `
            <div class="empty-state">
                <div class="welcome-icon">
                    <i class="fas fa-receipt"></i>
                </div>
                <h3>No transactions found</h3>
                <p>Try adjusting your filters or add some expenses to this group.</p>
                <button class="action-btn primary" onclick="window.location.href='/'">
                    <i class="fas fa-plus"></i>
                    Add Expense
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTransactions.map(transaction => `
        <div class="transaction-item" onclick="showTransactionDetails(${transaction.id})" style="
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 16px;
        ">
            <div class="transaction-icon" style="
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
                font-size: 20px;
            ">
                <i class="fas ${getTransactionIcon(transaction.category)}"></i>
            </div>
            <div class="transaction-content" style="flex: 1;">
                <div class="transaction-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h3 class="transaction-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
                        ${escapeHtml(transaction.description || 'No description')}
                    </h3>
                    <div class="transaction-amount" style="font-size: 18px; font-weight: 700; color: #059669;">
                        $${parseFloat(transaction.amount || 0).toFixed(2)}
                    </div>
                </div>
                <div class="transaction-meta" style="display: flex; gap: 16px; font-size: 14px; color: #6b7280;">
                    <span class="transaction-date">
                        <i class="fas fa-calendar"></i>
                        ${formatDate(transaction.date || transaction.created_at)}
                    </span>
                    <span class="transaction-category">
                        <i class="fas fa-tag"></i>
                        ${escapeHtml(transaction.category || 'Other')}
                    </span>
                    <span class="transaction-payer">
                        <i class="fas fa-user"></i>
                        Paid by ${escapeHtml(transaction.payer_name || 'Unknown')}
                    </span>
                </div>
                ${transaction.splits && transaction.splits.length > 0 ? `
                    <div class="transaction-splits" style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                        <i class="fas fa-users"></i>
                        Split between ${transaction.splits.length} member${transaction.splits.length !== 1 ? 's' : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Get appropriate icon for transaction category
function getTransactionIcon(category) {
    const iconMap = {
        'Food': 'fa-utensils',
        'Transportation': 'fa-car',
        'Entertainment': 'fa-gamepad',
        'Shopping': 'fa-shopping-cart',
        'Bills': 'fa-file-invoice',
        'Settlement': 'fa-handshake',
        'Other': 'fa-ellipsis-h'
    };
    return iconMap[category] || 'fa-receipt';
}

// Show transaction details in modal
async function showTransactionDetails(transactionId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/expenses/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const transaction = await response.json();
            displayTransactionModal(transaction);
        } else {
            throw new Error('Failed to load transaction details');
        }
    } catch (error) {
        console.error('Error loading transaction details:', error);
        showError('Failed to load transaction details');
    }
}

// Display transaction details in modal
function displayTransactionModal(transaction) {
    const modalBody = document.getElementById('transactionModalBody');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="transaction-details">
            <div class="detail-section">
                <h4>Expense Information</h4>
                <div class="detail-grid" style="display: grid; gap: 12px;">
                    <div class="detail-item" style="display: flex; justify-content: space-between;">
                        <label style="font-weight: 600;">Description:</label>
                        <span>${escapeHtml(transaction.description || 'No description')}</span>
                    </div>
                    <div class="detail-item" style="display: flex; justify-content: space-between;">
                        <label style="font-weight: 600;">Amount:</label>
                        <span class="amount" style="color: #059669; font-weight: 700;">$${parseFloat(transaction.amount || 0).toFixed(2)}</span>
                    </div>
                    <div class="detail-item" style="display: flex; justify-content: space-between;">
                        <label style="font-weight: 600;">Category:</label>
                        <span>${escapeHtml(transaction.category || 'Other')}</span>
                    </div>
                    <div class="detail-item" style="display: flex; justify-content: space-between;">
                        <label style="font-weight: 600;">Date:</label>
                        <span>${formatDate(transaction.date || transaction.created_at)}</span>
                    </div>
                    <div class="detail-item" style="display: flex; justify-content: space-between;">
                        <label style="font-weight: 600;">Paid by:</label>
                        <span>${escapeHtml(transaction.payer_name || 'Unknown')}</span>
                    </div>
                </div>
            </div>
            
            ${transaction.splits && transaction.splits.length > 0 ? `
                <div class="detail-section" style="margin-top: 20px;">
                    <h4>Split Details</h4>
                    <div class="splits-list">
                        ${transaction.splits.map(split => `
                            <div class="split-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                <span class="split-member">${escapeHtml(split.member_name || 'Unknown')}</span>
                                <span class="split-amount" style="font-weight: 600;">$${parseFloat(split.amount || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="action-btn secondary" onclick="closeTransactionModal()" style="
                    padding: 8px 16px;
                    border: 1px solid #d1d5db;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Close transaction modal
function closeTransactionModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Export transactions
function exportTransactions() {
    if (!filteredTransactions.length) {
        showError('No transactions to export');
        return;
    }
    
    const csvContent = generateCSV(filteredTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Generate CSV content
function generateCSV(transactions) {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Paid By'];
    const rows = transactions.map(tx => [
        formatDate(tx.date || tx.created_at),
        `"${tx.description || ''}"`,
        tx.category || '',
        parseFloat(tx.amount || 0).toFixed(2),
        `"${tx.payer_name || 'Unknown'}"`
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Initialize filters and event listeners
function initializeFilters() {
    // Set up event listeners for filters
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const dateFilter = document.getElementById('dateFilter');
    const memberFilter = document.getElementById('memberFilter');
    const sortBy = document.getElementById('sortBy');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (dateFilter) dateFilter.addEventListener('change', applyFilters);
    if (memberFilter) memberFilter.addEventListener('change', applyFilters);
    if (sortBy) sortBy.addEventListener('change', applyFilters);
}

function setupEventListeners() {
    // Close modal when clicking outside
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeTransactionModal();
            }
        });
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error(message);
    // You can implement a toast notification or use the existing error display method
    alert(message); // Temporary - replace with better UI
}

// Logout function
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    window.location.href = '/';
}
