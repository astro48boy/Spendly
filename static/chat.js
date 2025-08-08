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
    setActiveNavLink(); // Set navigation active state
    checkAuthentication();
    await loadGroups();
    setupEventListeners();
});

// Authentication check
function checkAuthentication() {
    authToken = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    
    console.log('🔍 Checking authentication...', { authToken: authToken ? 'Present' : 'Missing', userStr: userStr ? 'Present' : 'Missing' });
    
    if (!authToken || !userStr) {
        console.log('❌ No auth token or user found, redirecting to login');
        window.location.href = '/login';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    console.log('✅ User authenticated:', currentUser.email);
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
    
    // Enhanced input handling
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', (e) => {
        e.target.style.height = '44px';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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

// Typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message other-message typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    setTimeout(() => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
    
    return typingDiv;
}

function hideTypingIndicator() {
    const typingIndicator = chatMessages.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// API calls
async function apiCall(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log(`🔐 Making API call to ${url} with auth token: ${authToken.substring(0, 20)}...`);
    } else {
        console.log(`⚠️ Making API call to ${url} WITHOUT auth token`);
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    console.log(`📡 API response from ${url}: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
        console.log('❌ 401 Unauthorized, logging out');
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
    
    const timestamp = new Date(message.created_at).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    if (message.message_type === 'system') {
        // Add specific classes based on message content
        let systemClass = '';
        let icon = '🤖';
        
        if (message.message.includes('💰') || message.message.includes('✅')) {
            systemClass = ' success';
            icon = '✅';
        } else if (message.message.includes('❌') || message.message.includes('⚠️')) {
            systemClass = ' error';
            icon = '⚠️';
        }
        
        messageDiv.className += systemClass;
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">
                    <span class="system-icon">${icon}</span>
                    ${message.message}
                </div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
    } else {
        const isOwnMessage = message.user_id === currentUser.id;
        messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}-message`;
        
        // Check if this is from the same author as the previous message
        const lastMessage = chatMessages.lastElementChild;
        const isSameAuthor = lastMessage && 
            lastMessage.classList.contains(`${isOwnMessage ? 'own' : 'other'}-message`) &&
            !lastMessage.classList.contains('system-message');
        
        if (isSameAuthor) {
            messageDiv.classList.add('same-author');
        }
        
        // Get user initials for avatar
        const userInitials = message.user_name ? message.user_name.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) : 'U';
        
        messageDiv.innerHTML = `
            ${!isOwnMessage && !isSameAuthor ? `<div class="message-avatar">${userInitials}</div>` : ''}
            <div class="message-content">
                <div class="message-bubble">
                    ${!isSameAuthor ? `
                    <div class="message-header">
                        <span class="message-author">${isOwnMessage ? 'You' : message.user_name}</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    ` : ''}
                    <div class="message-text">${message.message}</div>
                    ${isSameAuthor ? `<div class="message-time" style="font-size: 0.6rem; margin-top: 2px; opacity: 0.6;">${timestamp}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Add animation and scroll to bottom smoothly
    chatMessages.appendChild(messageDiv);
    setTimeout(() => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentGroupId) return;

    try {
        console.log('🔍 DEBUG: Sending message:', message);
        console.log('🔍 DEBUG: Current group ID:', currentGroupId);
        
        // Clear input immediately for better UX
        messageInput.value = '';
        messageInput.style.height = '44px'; // Reset height for textarea
        
        // Show typing indicator
        showTypingIndicator();
        
        // Try to process as expense first
        const expenseResponse = await apiCall('/api/expenses', {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                group_id: parseInt(currentGroupId)
            })
        });
        
        console.log('🔍 DEBUG: Expense response status:', expenseResponse.status);
        console.log('🔍 DEBUG: Expense response ok:', expenseResponse.ok);
        
        if (expenseResponse.ok) {
            const result = await expenseResponse.json();
            console.log('✅ DEBUG: Expense response data:', result);
            
            // Display user message
            displayMessage({
                user_id: currentUser.id,
                user_name: currentUser.name,
                message: message,
                message_type: 'text',
                created_at: new Date().toISOString()
            });
            
            // Hide typing indicator and display system response
            hideTypingIndicator();
            displayMessage({
                user_id: 0,
                user_name: 'System',
                message: result.message,
                message_type: 'system',
                created_at: new Date().toISOString()
            });
        } else {
            const errorData = await expenseResponse.text();
            console.log('❌ DEBUG: Expense response error:', errorData);
            
            // If not an expense, send as regular message
            console.log('🔍 DEBUG: Sending as regular message...');
            const messageResponse = await apiCall(`/api/groups/${currentGroupId}/send-message`, {
                method: 'POST',
                body: JSON.stringify({
                    message: message
                })
            });
            
            console.log('🔍 DEBUG: Regular message response status:', messageResponse.status);
            
            if (messageResponse.ok) {
                console.log('✅ DEBUG: Regular message sent successfully');
                hideTypingIndicator();
                // Display the message
                displayMessage({
                    user_id: currentUser.id,
                    user_name: currentUser.name,
                    message: message,
                    message_type: 'text',
                    created_at: new Date().toISOString()
                });
            } else {
                hideTypingIndicator();
                const errorData = await messageResponse.text();
                console.log('❌ DEBUG: Regular message error:', errorData);
            }
        }
        
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again.');
        // Restore the message in input if there was an error
        messageInput.value = message;
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
