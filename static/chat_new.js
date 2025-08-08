// Chat Interface JavaScript
let currentGroupId = null;
let currentUser = null;
let authToken = null;

// DOM Elements
const groupSelect = document.getElementById('groupSelect');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const createGroupBtn = document.getElementById('createGroupBtn');
const addMemberBtn = document.getElementById('addMemberBtn');
const createGroupModal = document.getElementById('createGroupModal');
const addMemberModal = document.getElementById('addMemberModal');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    checkAuthentication();
    await loadGroups();
    setupEventListeners();
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

// Event Listeners
function setupEventListeners() {
    groupSelect.addEventListener('change', handleGroupChange);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    createGroupBtn.addEventListener('click', () => {
        createGroupModal.style.display = 'block';
    });
    
    addMemberBtn.addEventListener('click', () => {
        if (currentGroupId) {
            addMemberModal.style.display = 'block';
        }
    });
    
    // Modal close handlers
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Form handlers
    document.getElementById('createGroupForm').addEventListener('submit', createGroup);
    document.getElementById('addMemberForm').addEventListener('submit', addMember);
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

// Load groups
async function loadGroups() {
    try {
        const response = await apiCall('/api/groups');
        if (response.ok) {
            const groups = await response.json();
            groupSelect.innerHTML = '<option value="">Select a group...</option>';
            
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                groupSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Handle group change
async function handleGroupChange() {
    currentGroupId = groupSelect.value;
    
    if (currentGroupId) {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        addMemberBtn.disabled = false;
        await loadChatHistory();
    } else {
        messageInput.disabled = true;
        sendBtn.disabled = true;
        addMemberBtn.disabled = true;
        clearChat();
    }
}

// Load chat history
async function loadChatHistory() {
    try {
        const response = await apiCall(`/api/groups/${currentGroupId}/messages`);
        if (response.ok) {
            const data = await response.json();
            displayChatHistory(data.messages);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Display chat history
function displayChatHistory(messages) {
    chatMessages.innerHTML = `
        <div class="system-message">
            👋 Hi! I'm your expense assistant. Tell me about expenses in natural language like:
            <ul>
                <li>"I paid $25 for pizza for everyone"</li>
                <li>"John spent 15.50 on coffee for him and Mary"</li>
                <li>"Sarah bought groceries for $45, split it equally"</li>
            </ul>
        </div>
    `;
    
    messages.forEach(message => {
        displayMessage(message);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display individual message
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.message_type}-message`;
    
    const timestamp = new Date(message.created_at).toLocaleTimeString();
    
    if (message.message_type === 'system') {
        messageDiv.innerHTML = `
            <div class="system-content">
                <span class="timestamp">${timestamp}</span>
                ${message.message}
            </div>
        `;
    } else {
        const isOwnMessage = message.user_id === currentUser.id;
        messageDiv.className += isOwnMessage ? ' own-message' : ' other-message';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="user-name">${message.user_name}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${message.message}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentGroupId) return;
    
    try {
        // Try to process as expense first
        const expenseResponse = await apiCall('/api/expenses', {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                group_id: parseInt(currentGroupId)
            })
        });
        
        if (expenseResponse.ok) {
            const result = await expenseResponse.json();
            
            // Display user message
            displayMessage({
                user_id: currentUser.id,
                user_name: currentUser.name,
                message: message,
                message_type: 'text',
                created_at: new Date().toISOString()
            });
            
            // Display system response
            displayMessage({
                user_id: 0,
                user_name: 'System',
                message: result.message,
                message_type: 'system',
                created_at: new Date().toISOString()
            });
        } else {
            // If not an expense, send as regular message
            const messageResponse = await apiCall(`/api/groups/${currentGroupId}/send-message`, {
                method: 'POST',
                body: JSON.stringify({
                    message: message,
                    group_id: parseInt(currentGroupId)
                })
            });
            
            if (messageResponse.ok) {
                // Display the message
                displayMessage({
                    user_id: currentUser.id,
                    user_name: currentUser.name,
                    message: message,
                    message_type: 'text',
                    created_at: new Date().toISOString()
                });
            }
        }
        
        messageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again.');
    }
}

// Create group
async function createGroup(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const memberEmails = formData.get('member_emails');
    
    const groupData = {
        name: formData.get('name'),
        description: formData.get('description') || '',
        member_emails: memberEmails ? memberEmails.split(',').map(email => email.trim()) : []
    };
    
    try {
        const response = await apiCall('/api/groups', {
            method: 'POST',
            body: JSON.stringify(groupData)
        });
        
        if (response.ok) {
            const group = await response.json();
            alert('Group created successfully!');
            createGroupModal.style.display = 'none';
            e.target.reset();
            await loadGroups();
            
            // Select the new group
            groupSelect.value = group.id;
            await handleGroupChange();
        } else {
            const error = await response.json();
            alert(`Error: ${error.detail}`);
        }
    } catch (error) {
        console.error('Error creating group:', error);
        alert('Error creating group. Please try again.');
    }
}

// Add member
async function addMember(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        user_email: formData.get('user_email')
    };
    
    try {
        const response = await apiCall(`/api/groups/${currentGroupId}/add-member`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            alert('Member added successfully!');
            addMemberModal.style.display = 'none';
            e.target.reset();
            // Reload chat to see the system message
            await loadChatHistory();
        } else {
            const error = await response.json();
            alert(`Error: ${error.detail}`);
        }
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Error adding member. Please try again.');
    }
}

// Clear chat
function clearChat() {
    chatMessages.innerHTML = `
        <div class="system-message">
            👋 Select a group to start chatting and adding expenses!
        </div>
    `;
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});
