// Navigation active state management
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        
        if ((currentPath === '/' || currentPath === '/chat') && href === '/chat') {
            link.classList.add('active');
        } else if (currentPath === href) {
            link.classList.add('active');
        }
    });
}

// Call when DOM is loaded
document.addEventListener('DOMContentLoaded', setActiveNavLink);

class DashboardManager {
    constructor() {
        this.currentGroup = null;
        this.groups = [];
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            await this.loadUserInfo();
            await this.loadGroups();
            this.setupEventListeners();
            this.showWelcomeState();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to load dashboard');
        }
    }

    async loadUserInfo() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            // Get user info from localStorage
            const userStr = localStorage.getItem('user');
            if (userStr) {
                this.currentUser = JSON.parse(userStr);
            } else {
                // Fallback user info
                this.currentUser = {
                    name: 'User',
                    email: 'user@example.com'
                };
            }

            this.updateUserDisplay();
        } catch (error) {
            console.error('Failed to load user info:', error);
            window.location.href = '/login';
        }
    }

    updateUserDisplay() {
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        const userInfoEl = document.getElementById('userInfo');
        
        if (userNameEl && this.currentUser) {
            userNameEl.textContent = this.currentUser.name;
        }
        
        if (userAvatarEl && this.currentUser) {
            userAvatarEl.textContent = this.currentUser.name.charAt(0).toUpperCase();
        }
        
        // Show the user info section
        if (userInfoEl && this.currentUser) {
            userInfoEl.style.display = 'flex';
        }
    }

    async loadGroups() {
        try {
            this.showLoadingState();
            
            const token = localStorage.getItem('access_token');
            console.log('🔑 Loading groups with token:', token ? 'Present' : 'Missing');
            
            const response = await fetch('/api/groups', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Groups response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Groups response error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.groups = await response.json();
            console.log('✅ Groups loaded:', this.groups);
            
            // Load expense counts for each group
            await this.loadGroupExpenseCounts();
            
            this.renderGroups();
            
            if (this.groups.length === 0) {
                this.showWelcomeState();
            }
        } catch (error) {
            console.error('❌ Failed to load groups:', error);
            this.showError('Failed to load groups');
        }
    }

    async loadGroupExpenseCounts() {
        console.log('📊 Loading expense counts for groups...');
        const token = localStorage.getItem('access_token');
        
        // Load expenses count for each group in parallel
        const promises = this.groups.map(async (group) => {
            try {
                const response = await fetch(`/api/groups/${group.id}/expenses`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const expenses = await response.json();
                    group.expenses = expenses; // Add expenses to group object
                    console.log(`✅ Loaded ${expenses.length} expenses for group ${group.name}`);
                } else {
                    console.warn(`⚠️ Failed to load expenses for group ${group.name}`);
                    group.expenses = []; // Default to empty array
                }
            } catch (error) {
                console.error(`❌ Error loading expenses for group ${group.name}:`, error);
                group.expenses = []; // Default to empty array
            }
        });
        
        await Promise.all(promises);
        console.log('✅ All expense counts loaded');
    }

    showLoadingState() {
        const groupsList = document.getElementById('groupsList');
        if (groupsList) {
            groupsList.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading groups...</span>
                </div>
            `;
        }
    }

    renderGroups() {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) {
            console.error('❌ Groups list element not found');
            return;
        }

        console.log('🔄 Rendering groups:', this.groups);

        if (this.groups.length === 0) {
            groupsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Groups Yet</h3>
                    <p>Create your first group to start tracking expenses</p>
                </div>
            `;
            return;
        }

        groupsList.innerHTML = this.groups.map(group => {
            console.log('📝 Rendering group:', group);
            const balance = this.calculateGroupBalance(group);
            const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
            
            return `
                <div class="group-card" data-group-id="${group.id}" onclick="window.dashboard.selectGroup(${group.id})">
                    <div class="group-header-info">
                        <div class="group-name">${this.escapeHtml(group.name)}</div>
                        <div class="group-balance ${balanceClass}">
                            ${this.formatCurrency(Math.abs(balance))}
                        </div>
                    </div>
                    <div class="group-summary">
                        <span><i class="fas fa-users"></i> ${group.members?.length || 0} members</span>
                        <span><i class="fas fa-receipt"></i> ${group.expenses?.length || 0} expenses</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    calculateGroupBalance(group) {
        // Calculate the current user's balance in the group
        if (!group.expenses || group.expenses.length === 0) {
            return 0;
        }

        let userBalance = 0;
        const userId = this.currentUser.id;

        group.expenses.forEach(expense => {
            // How much user paid
            const userPaid = expense.paid_by === userId ? expense.amount : 0;
            
            // How much user owes (equal split among group members)
            const splitCount = group.members ? group.members.length : 1;
            const userOwes = expense.amount / splitCount;
            
            // User's balance for this expense
            userBalance += userPaid - userOwes;
        });

        return userBalance;
    }

    async selectGroup(groupId) {
        console.log('🎯 Selecting group:', groupId);
        try {
            // Remove active class from all group cards
            document.querySelectorAll('.group-card').forEach(card => {
                card.classList.remove('active');
            });

            // Add active class to selected group
            const selectedCard = document.querySelector(`[data-group-id="${groupId}"]`);
            if (selectedCard) {
                selectedCard.classList.add('active');
                console.log('✅ Active class added to group card');
            } else {
                console.error('❌ Selected group card not found');
            }

            // Load fresh group details with latest data
            await this.loadGroupDetails(groupId);
            
        } catch (error) {
            console.error('❌ Failed to select group:', error);
            this.showError('Failed to load group details');
        }
    }

    async loadGroupDetails(groupId) {
        console.log('📊 Loading group details for:', groupId);
        try {
            const token = localStorage.getItem('access_token');
            console.log('🔑 Using token:', token ? 'Present' : 'Missing');
            
            // Load group details
            console.log('📡 Fetching group details...');
            const groupResponse = await fetch(`/api/groups/${groupId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Group response status:', groupResponse.status);
            if (!groupResponse.ok) {
                const errorText = await groupResponse.text();
                console.error('❌ Group response error:', errorText);
                throw new Error(`Failed to load group: ${groupResponse.status}`);
            }

            const group = await groupResponse.json();
            console.log('✅ Group data received:', group);
            
            // Load group expenses
            console.log('📡 Fetching group expenses...');
            const expensesResponse = await fetch(`/api/groups/${groupId}/expenses`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Expenses response status:', expensesResponse.status);
            if (!expensesResponse.ok) {
                const errorText = await expensesResponse.text();
                console.error('❌ Expenses response error:', errorText);
                throw new Error(`Failed to load expenses: ${expensesResponse.status}`);
            }

            const expenses = await expensesResponse.json();
            console.log('✅ Expenses data received:', expenses);
            
            this.currentGroup = { ...group, expenses };
            console.log('📝 Current group set:', this.currentGroup);
            this.renderGroupDetails();
            
        } catch (error) {
            console.error('❌ Failed to load group details:', error);
            this.showError('Failed to load group details');
        }
    }

    renderGroupDetails() {
        console.log('🎨 Rendering group details for:', this.currentGroup);
        const welcomeState = document.getElementById('welcomeState');
        const groupDetails = document.getElementById('groupDetails');
        
        if (!welcomeState || !groupDetails) {
            console.error('❌ Welcome state or group details elements not found');
            return;
        }
        if (!this.currentGroup) {
            console.error('❌ No current group set');
            return;
        }

        // Hide welcome state and show group details
        welcomeState.style.display = 'none';
        groupDetails.style.display = 'block';

        const stats = this.calculateGroupStats();
        console.log('📊 Calculated stats:', stats);
        
        groupDetails.innerHTML = `
            <div class="group-header">
                <div>
                    <h1 class="group-title">${this.escapeHtml(this.currentGroup.name)}</h1>
                    <div class="group-meta">
                        <span><i class="fas fa-users"></i> ${this.currentGroup.members?.length || 0} members</span>
                        <span><i class="fas fa-calendar"></i> Created ${this.formatDate(this.currentGroup.created_at)}</span>
                        <span><i class="fas fa-receipt"></i> ${this.currentGroup.expenses?.length || 0} expenses</span>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="action-btn primary" onclick="window.dashboard.showAddExpenseForm()">
                        <i class="fas fa-plus"></i>
                        Add Expense
                    </button>
                    <button class="action-btn secondary" onclick="window.dashboard.showGroupSettings()">
                        <i class="fas fa-cog"></i>
                        Settings
                    </button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card ${stats.balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                    <div class="stat-icon">
                        <i class="fas fa-balance-scale"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Your Balance</h3>
                        <div class="stat-value">${this.formatCurrency(Math.abs(stats.balance))}</div>
                        <div class="stat-label">${stats.balance >= 0 ? 'You are owed' : 'You owe'}</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Total Paid</h3>
                        <div class="stat-value">${this.formatCurrency(stats.totalPaid)}</div>
                        <div class="stat-label">Your contributions</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Your Share</h3>
                        <div class="stat-value">${this.formatCurrency(stats.yourShare)}</div>
                        <div class="stat-label">Of total expenses</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2><i class="fas fa-users"></i> Members</h2>
                    <button class="view-all-btn" onclick="window.dashboard.showAllMembers()">
                        View All <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                <div class="members-grid" id="membersGrid">
                    ${this.renderMembersGrid()}
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2><i class="fas fa-history"></i> Recent Transactions</h2>
                    <button class="view-all-btn" onclick="window.dashboard.showAllTransactions()">
                        View All <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                <div class="transactions-list" id="transactionsList">
                    ${this.renderTransactionsList()}
                </div>
            </div>
        `;
        console.log('✅ Group details rendered successfully');
    }

    calculateGroupStats() {
        if (!this.currentGroup || !this.currentGroup.expenses) {
            return {
                balance: 0,
                totalPaid: 0,
                yourShare: 0
            };
        }

        const userId = this.currentUser.id;
        let totalPaid = 0;
        let yourShare = 0;
        let balance = 0;

        this.currentGroup.expenses.forEach(expense => {
            // Calculate how much user paid
            if (expense.paid_by === userId) {
                totalPaid += expense.amount;
            }
            
            // Calculate user's share (equal split among group members)
            const splitCount = this.currentGroup.members ? this.currentGroup.members.length : 1;
            const userShare = expense.amount / splitCount;
            yourShare += userShare;
            
            // Calculate balance for this expense
            const userPaid = expense.paid_by === userId ? expense.amount : 0;
            balance += userPaid - userShare;
        });

        return {
            balance: balance,
            totalPaid: totalPaid,
            yourShare: yourShare
        };
    }

    renderMembersGrid() {
        if (!this.currentGroup.members || this.currentGroup.members.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <h3>No Members</h3>
                    <p>Add members to start splitting expenses</p>
                </div>
            `;
        }

        return this.currentGroup.members.slice(0, 6).map(member => {
            // Calculate real member statistics
            const memberStats = this.calculateMemberStats(member);
            const balanceClass = memberStats.balance >= 0 ? 'positive' : 'negative';
            
            return `
                <div class="member-card">
                    <div class="member-header">
                        <div class="member-avatar">
                            ${member.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="member-name">${this.escapeHtml(member.name)}</div>
                    </div>
                    <div class="member-stats">
                        <div class="member-stat">
                            <span class="member-stat-label">Balance</span>
                            <span class="member-stat-value ${balanceClass}">
                                ${this.formatCurrency(Math.abs(memberStats.balance))}
                            </span>
                        </div>
                        <div class="member-stat">
                            <span class="member-stat-label">Paid</span>
                            <span class="member-stat-value">${this.formatCurrency(memberStats.totalPaid)}</span>
                        </div>
                        <div class="member-stat">
                            <span class="member-stat-label">Share</span>
                            <span class="member-stat-value">${this.formatCurrency(memberStats.totalShare)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    calculateMemberStats(member) {
        if (!this.currentGroup.expenses) {
            return { balance: 0, totalPaid: 0, totalShare: 0 };
        }

        let totalPaid = 0;
        let totalShare = 0;
        
        this.currentGroup.expenses.forEach(expense => {
            // How much this member paid
            if (expense.paid_by === member.id) {
                totalPaid += expense.amount;
            }
            
            // This member's share (equal split among group members)
            const splitCount = this.currentGroup.members.length;
            totalShare += expense.amount / splitCount;
        });

        const balance = totalPaid - totalShare;
        
        return {
            balance: balance,
            totalPaid: totalPaid,
            totalShare: totalShare
        };
    }

    renderTransactionsList() {
        if (!this.currentGroup.expenses || this.currentGroup.expenses.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No Transactions</h3>
                    <p>Add your first expense to get started</p>
                </div>
            `;
        }

        return this.currentGroup.expenses.slice(0, 5).map(expense => {
            // Find who paid for this expense
            const paidByUser = this.currentGroup.members.find(member => member.id === expense.paid_by);
            const paidByName = paidByUser ? paidByUser.name : 'Unknown';
            
            return `
                <div class="transaction-item">
                    <div class="transaction-icon expense">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-description">${this.escapeHtml(expense.description)}</div>
                        <div class="transaction-meta">
                            <span>Paid by ${this.escapeHtml(paidByName)}</span>
                            <span>Split among ${this.currentGroup.members.length} members</span>
                        </div>
                    </div>
                    <div class="transaction-amount">
                        <div class="transaction-value expense">${this.formatCurrency(expense.amount)}</div>
                        <div class="transaction-date">${this.formatDate(expense.created_at)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showWelcomeState() {
        console.log('🏠 Showing welcome state');
        const welcomeState = document.getElementById('welcomeState');
        const groupDetails = document.getElementById('groupDetails');
        
        if (welcomeState && groupDetails) {
            welcomeState.style.display = 'flex';
            groupDetails.style.display = 'none';
        } else {
            console.error('❌ Welcome state or group details elements not found');
        }
    }

    setupEventListeners() {
        // Create group button
        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => this.showCreateGroupForm());
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Refresh on window focus
        window.addEventListener('focus', () => {
            this.loadGroups();
        });
    }

    showCreateGroupForm() {
        // This would show a modal or navigate to create group page
        console.log('Show create group form');
        // For now, just redirect
        window.location.href = '/create-group';
    }

    showAddExpenseForm() {
        // This would show expense form
        console.log('Show add expense form');
        window.location.href = '/add-expense';
    }

    showGroupSettings() {
        console.log('Show group settings');
    }

    showAllMembers() {
        // Navigate to members page
        window.location.href = '/members';
    }

    showAllTransactions() {
        // Navigate to transactions page
        window.location.href = '/transactions';
    }

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    // Settle Functionality
    showSettleModal() {
        if (!this.currentGroup) {
            alert('Please select a group first');
            return;
        }
        
        const modal = document.getElementById('settleModal');
        const modalBody = document.getElementById('settleModalBody');
        
        if (!modal || !modalBody) {
            console.error('Settle modal elements not found');
            return;
        }
        
        this.loadSettleOptions(modalBody);
        modal.style.display = 'flex';
    }
    
    async loadSettleOptions(modalBody) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/groups/${this.currentGroup.id}/breakdown`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to load breakdown');
            
            const breakdown = await response.json();
            const currentUserId = this.currentUser.id;
            const userBreakdown = breakdown.user_breakdowns.find(ub => ub.user_id === currentUserId);
            
            if (!userBreakdown || Math.abs(userBreakdown.balance) < 0.01) {
                modalBody.innerHTML = `
                    <div class="settle-empty">
                        <i class="fas fa-check-circle"></i>
                        <h4>All Settled Up!</h4>
                        <p>You don't have any outstanding balances in this group.</p>
                    </div>
                `;
                return;
            }
            
            // Find members to settle with
            const settleOptions = breakdown.user_breakdowns
                .filter(ub => ub.user_id !== currentUserId && Math.abs(ub.balance) > 0.01)
                .map(ub => {
                    const canSettle = (userBreakdown.balance > 0 && ub.balance < 0) || 
                                     (userBreakdown.balance < 0 && ub.balance > 0);
                    return { ...ub, canSettle };
                });
            
            modalBody.innerHTML = `
                <div class="settle-content">
                    <div class="settle-summary">
                        <h4>Your Balance: <span class="${userBreakdown.balance >= 0 ? 'positive' : 'negative'}">
                            $${Math.abs(userBreakdown.balance).toFixed(2)}
                        </span></h4>
                        <p>${userBreakdown.balance >= 0 ? 'You are owed money' : 'You owe money'}</p>
                    </div>
                    
                    <div class="settle-options">
                        <h4>Settlement Options:</h4>
                        ${settleOptions.length > 0 ? settleOptions.map(member => `
                            <div class="settle-option">
                                <div class="settle-member">
                                    <strong>${member.user_name}</strong>
                                    <span class="${member.balance >= 0 ? 'positive' : 'negative'}">
                                        ${member.balance >= 0 ? 'owes' : 'is owed'} $${Math.abs(member.balance).toFixed(2)}
                                    </span>
                                </div>
                                ${member.canSettle ? `
                                    <button class="action-btn primary" onclick="window.dashboard.recordSettlement(${member.user_id})">
                                        <i class="fas fa-handshake"></i>
                                        Settle
                                    </button>
                                ` : '<span class="text-muted">Cannot settle directly</span>'}
                            </div>
                        `).join('') : '<p>No settlement options available.</p>'}
                    </div>
                    
                    <div class="settle-actions">
                        <button class="action-btn secondary" onclick="window.dashboard.closeSettleModal()">
                            Cancel
                        </button>
                        <button class="action-btn primary" onclick="window.dashboard.settleAllInGroup()">
                            <i class="fas fa-check-double"></i>
                            Settle All in Group
                        </button>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading settle options:', error);
            modalBody.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load settlement options. Please try again.</p>
                </div>
            `;
        }
    }
    
    async recordSettlement(memberId) {
        try {
            const amount = prompt('Enter the settlement amount:');
            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            const token = localStorage.getItem('access_token');
            const settlementData = {
                group_id: this.currentGroup.id,
                payer_id: this.currentUser.id,
                payee_id: memberId,
                payer_name: this.currentUser.name,
                payee_name: 'Member', // We'd need to get the actual name
                amount: parseFloat(amount)
            };
            
            const response = await fetch('/api/groups/settle-debt', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settlementData)
            });
            
            if (!response.ok) throw new Error('Settlement failed');
            
            const result = await response.json();
            alert(result.message || 'Settlement recorded successfully!');
            
            this.closeSettleModal();
            this.loadGroupDetails(this.currentGroup.id);
            
        } catch (error) {
            console.error('Error recording settlement:', error);
            alert('Failed to record settlement. Please try again.');
        }
    }
    
    async settleAllInGroup() {
        if (!confirm('This will settle all your balances in this group. Continue?')) {
            return;
        }
        
        try {
            // In a real implementation, you'd have a bulk settle API endpoint
            alert('Bulk settlement feature coming soon!');
            this.closeSettleModal();
            
        } catch (error) {
            console.error('Error settling all:', error);
            alert('Failed to settle all balances. Please try again.');
        }
    }
    
    closeSettleModal() {
        const modal = document.getElementById('settleModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        // Simple error handling - in production, use a proper toast/notification system
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="welcome-state">
                    <div class="welcome-content">
                        <div class="welcome-icon" style="background: var(--red-100); color: var(--red-600);">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h2>Oops! Something went wrong</h2>
                        <p>${this.escapeHtml(message)}</p>
                        <button class="action-btn primary" onclick="location.reload()" style="margin-top: var(--space-4);">
                            <i class="fas fa-refresh"></i>
                            Try Again
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Utility functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
            Math.floor((date - new Date()) / (1000 * 60 * 60 * 24)), 'day'
        );
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global logout function for HTML onclick
function logout() {
    if (window.dashboard) {
        window.dashboard.logout();
    } else {
        // Fallback logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});

// Auto-refresh groups and current group every 30 seconds for real-time updates
setInterval(() => {
    if (window.dashboard) {
        console.log('🔄 Auto-refreshing dashboard data...');
        window.dashboard.loadGroups();
        
        // If a group is currently selected, refresh its details too
        if (window.dashboard.currentGroup) {
            window.dashboard.loadGroupDetails(window.dashboard.currentGroup.id);
        }
    }
}, 30000);
