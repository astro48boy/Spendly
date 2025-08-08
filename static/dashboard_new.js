// Dashboard JavaScript
let currentUser = null;
let authToken = null;
let selectedGroupId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    checkAuthentication();
    await loadGroupsList();
});

// Authentication check
function checkAuthentication() {
    authToken = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    
    if (!authToken || !userStr) {
        window.location.href = '/login';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userInfo').style.display = 'flex';
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// API calls
async function apiCall(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        logout();
        return;
    }
    
    return response;
}

// Load groups list
async function loadGroupsList() {
    try {
        const response = await apiCall('/api/my-breakdown');
        if (response.ok) {
            const breakdowns = await response.json();
            displayGroupsList(breakdowns);
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Display groups list
function displayGroupsList(breakdowns) {
    const groupsList = document.getElementById('groupsList');
    
    if (breakdowns.length === 0) {
        groupsList.innerHTML = `
            <div class="no-groups">
                <p>No groups found. <a href="/">Create your first group</a> to get started!</p>
            </div>
        `;
        return;
    }
    
    groupsList.innerHTML = '';
    
    breakdowns.forEach(breakdown => {
        const groupCard = document.createElement('div');
        groupCard.className = 'group-card';
        groupCard.onclick = () => selectGroup(breakdown);
        
        // Calculate user's balance
        const userBreakdown = breakdown.user_breakdowns.find(ub => ub.user_id === currentUser.id);
        const balance = userBreakdown ? userBreakdown.balance : 0;
        const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
        
        groupCard.innerHTML = `
            <div class="group-header">
                <h3>${breakdown.group_name}</h3>
                <div class="balance ${balanceClass}">
                    ${balance > 0 ? '+' : ''}$${Math.abs(balance).toFixed(2)}
                </div>
            </div>
            <div class="group-summary">
                <span>Total: $${breakdown.total_expenses.toFixed(2)}</span>
                <span>${breakdown.user_breakdowns.length} members</span>
            </div>
        `;
        
        groupsList.appendChild(groupCard);
    });
}

// Select group for detailed view
function selectGroup(breakdown) {
    selectedGroupId = breakdown.group_id;
    
    // Update group details
    document.getElementById('selectedGroupName').textContent = breakdown.group_name;
    document.getElementById('totalExpenses').textContent = `$${breakdown.total_expenses.toFixed(2)}`;
    
    // Display members breakdown
    displayMembersBreakdown(breakdown.user_breakdowns);
    
    // Load recent expenses
    loadRecentExpenses(breakdown.group_id);
    
    // Show group details section
    document.getElementById('groupDetails').style.display = 'block';
    
    // Highlight selected group
    document.querySelectorAll('.group-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

// Display members breakdown
function displayMembersBreakdown(userBreakdowns) {
    const container = document.getElementById('membersBreakdown');
    container.innerHTML = '';
    
    userBreakdowns.forEach(user => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-breakdown';
        
        const balanceClass = user.balance > 0 ? 'positive' : user.balance < 0 ? 'negative' : 'neutral';
        const balanceText = user.balance > 0 ? 'should receive' : user.balance < 0 ? 'owes' : 'settled';
        
        memberDiv.innerHTML = `
            <div class="member-info">
                <div class="member-name">${user.user_name}</div>
                <div class="member-details">
                    <span>Paid: $${user.total_paid.toFixed(2)}</span>
                    <span>Owes: $${user.total_owed.toFixed(2)}</span>
                </div>
            </div>
            <div class="member-balance ${balanceClass}">
                ${balanceText}: $${Math.abs(user.balance).toFixed(2)}
            </div>
        `;
        
        container.appendChild(memberDiv);
    });
}

// Load recent expenses
async function loadRecentExpenses(groupId) {
    try {
        const response = await apiCall(`/api/expenses?group_id=${groupId}&limit=10`);
        if (response.ok) {
            const expenses = await response.json();
            displayRecentExpenses(expenses);
        }
    } catch (error) {
        console.error('Error loading recent expenses:', error);
    }
}

// Display recent expenses
function displayRecentExpenses(expenses) {
    const container = document.getElementById('recentExpenses');
    
    if (expenses.length === 0) {
        container.innerHTML = '<p>No expenses yet.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    expenses.forEach(expense => {
        const expenseDiv = document.createElement('div');
        expenseDiv.className = 'expense-item';
        
        const date = new Date(expense.created_at).toLocaleDateString();
        
        expenseDiv.innerHTML = `
            <div class="expense-info">
                <div class="expense-description">${expense.description}</div>
                <div class="expense-meta">
                    <span>Paid by: ${expense.payer ? expense.payer.name : 'Unknown'}</span>
                    <span>${date}</span>
                </div>
            </div>
            <div class="expense-amount">$${expense.amount.toFixed(2)}</div>
        `;
        
        container.appendChild(expenseDiv);
    });
}
