// Enhanced Socket.io connection with better error handling
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000
});

// Global variables
let currentUser = null;
let currentView = 'community';
let profileUrl = null;
let inboxCount = 0;
let isConnected = false;
let typingTimer = null;
let reconnectAttempts = 0;
let messageCount = 0;

// DOM elements
const profileModal = document.getElementById('profileModal');
const profileForm = document.getElementById('profileForm');
const shareModal = document.getElementById('shareModal');
const userProfile = document.getElementById('userProfile');
const profileActions = document.getElementById('profileActions');
const messages = document.getElementById('messages');
const inboxMessages = document.getElementById('inboxMessages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const userCountSpan = document.getElementById('userCount');
const typingIndicator = document.getElementById('typingIndicator');
const toast = document.getElementById('toast');
const loadingOverlay = document.getElementById('loadingOverlay');
const navItems = document.querySelectorAll('.nav-item');
const chatViews = document.querySelectorAll('.chat-view');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const connectionStatus = document.getElementById('connectionStatus');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    showLoadingOverlay();
    setupEventListeners();
    setupNavigation();
    checkForProfileLink();
    setupMobileMenu();
    setupEmojiPicker();
    updateConnectionStatus('connecting');
    
    // Show profile modal after a brief delay
    setTimeout(() => {
        hideLoadingOverlay();
        showProfileModal();
    }, 1000);
});

// Loading overlay functions
function showLoadingOverlay() {
    loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    loadingOverlay.style.display = 'none';
}

// Update connection status
function updateConnectionStatus(status) {
    const statusIcon = connectionStatus.querySelector('i');
    const statusText = connectionStatus.querySelector('span');
    
    connectionStatus.className = `connection-status ${status}`;
    
    switch(status) {
        case 'connected':
            statusIcon.className = 'fas fa-circle';
            statusText.textContent = 'Connected';
            break;
        case 'disconnected':
            statusIcon.className = 'fas fa-circle';
            statusText.textContent = 'Disconnected';
            break;
        case 'connecting':
            statusIcon.className = 'fas fa-spinner fa-pulse';
            statusText.textContent = 'Connecting...';
            break;
        case 'reconnecting':
            statusIcon.className = 'fas fa-spinner fa-spin';
            statusText.textContent = 'Reconnecting...';
            break;
    }
}

// Check if accessing a profile link
function checkForProfileLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileParam = urlParams.get('to');
    
    if (profileParam) {
        document.getElementById('profileUrlInput').value = profileParam;
        setTimeout(() => {
            switchView('anonymous');
        }, 2000);
    }
}

// Mobile menu setup
function setupMobileMenu() {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target) && 
            sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

// Setup emoji picker
function setupEmojiPicker() {
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const emojis = document.querySelectorAll('.emoji');
    
    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });
    
    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            const emojiChar = emoji.getAttribute('data-emoji');
            input.value += emojiChar;
            emojiPicker.style.display = 'none';
            input.focus();
        });
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Profile form submission
    profileForm.addEventListener('submit', handleProfileSubmit);
    
    // Community chat form
    form.addEventListener('submit', handleMessageSubmit);
    
    // Profile actions
    document.getElementById('shareProfileBtn').addEventListener('click', showShareModal);
    document.getElementById('editProfileBtn').addEventListener('click', showProfileModal);
    document.getElementById('copyProfileBtn').addEventListener('click', copyProfileLink);
    
    // Share buttons
    document.getElementById('copyLinkBtn').addEventListener('click', copyProfileLink);
    document.getElementById('shareWhatsAppBtn').addEventListener('click', shareOnWhatsApp);
    document.getElementById('shareTwitterBtn').addEventListener('click', shareOnTwitter);
    document.getElementById('shareFacebookBtn').addEventListener('click', shareOnFacebook);
    
    // Anonymous messaging
    document.getElementById('sendAnonymousBtn').addEventListener('click', sendAnonymousMessage);
    
    // Character counter for anonymous message
    document.getElementById('anonymousMessage').addEventListener('input', updateCharCounter);
    
    // Input character counter
    input.addEventListener('input', () => {
        document.getElementById('inputCounter').textContent = input.value.length;
    });
    
    // Profile picture upload
    document.getElementById('profilePicUpload').addEventListener('change', handleProfilePicUpload);
    
    // Input typing events
    input.addEventListener('input', handleTyping);
    input.addEventListener('keypress', handleKeyPress);
    
    // Media upload
    document.getElementById('mediaBtn').addEventListener('click', () => {
        document.getElementById('mediaFileInput').click();
    });
    
    // Refresh inbox
    document.getElementById('refreshInboxBtn').addEventListener('click', refreshInbox);
    
    // Clear chat
    document.getElementById('clearChatBtn').addEventListener('click', clearChat);
    
    // Clear inbox
    document.getElementById('clearInboxBtn').addEventListener('click', clearInbox);
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', showHelp);
    
    // Paste button
    document.getElementById('pasteBtn').addEventListener('click', pasteFromClipboard);
    
    // Refresh chat
    document.getElementById('refreshChatBtn').addEventListener('click', refreshChat);
}

// Setup navigation
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
            
            // Close mobile menu
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });
}

// Switch between views
function switchView(view) {
    // Update navigation
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });
    
    // Update chat views
    chatViews.forEach(chatView => {
        chatView.style.display = 'none';
    });
    
    const targetView = document.getElementById(view + 'View');
    if (targetView) {
        targetView.style.display = 'flex';
    }
    
    currentView = view;
    
    // Load view-specific data
    if (view === 'inbox') {
        loadInboxMessages();
    }
}

// Profile modal functions
function showProfileModal() {
    profileModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Pre-fill existing data if user exists
    if (currentUser) {
        document.getElementById('username').value = currentUser.username;
    }
}

function hideProfileModal() {
    profileModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showShareModal() {
    if (profileUrl) {
        const fullUrl = `${window.location.origin}/to/${profileUrl}`;
        document.getElementById('shareLink').value = fullUrl;
        shareModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        showToast('Profile URL not available. Please reconnect.', 'error');
    }
}

function closeShareModal() {
    shareModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Handle profile form submission
async function handleProfileSubmit(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showToast('Please enter a username', 'error');
        return;
    }
    
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    
    if (username.length > 30) {
        showToast('Username must be less than 30 characters', 'error');
        return;
    }
    
    showLoadingOverlay();
    
    const profilePicFile = document.getElementById('profilePicUpload').files[0];
    let profilePicUrl = 'https://via.placeholder.com/50x50/eaa306/0a0a1a?text=U';
    
    if (profilePicFile) {
        try {
            profilePicUrl = await uploadProfilePicture(profilePicFile);
        } catch (error) {
            showToast('Failed to upload profile picture', 'error');
            hideLoadingOverlay();
            return;
        }
    }
    
    currentUser = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        username: username,
        profilePic: profilePicUrl
    };
    
    // Connect to socket with user data
    socket.emit('user connected', currentUser);
    
    // Update UI
    updateUserProfile();
    hideProfileModal();
    hideLoadingOverlay();
    showToast('Welcome to the community!', 'success');
}

// Upload profile picture
async function uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profilePic', file);
    
    try {
        const response = await fetch('/upload-profile-pic', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const result = await response.json();
        if (result.success) {
            return result.url;
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        throw new Error('Failed to upload profile picture');
    }
}

// Handle profile picture upload preview
function handleProfilePicUpload(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showToast('File size too large (max 10MB)', 'error');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profilePreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Update user profile display
function updateUserProfile() {
    if (currentUser) {
        document.getElementById('profilePic').src = currentUser.profilePic;
        document.getElementById('profileName').textContent = currentUser.username;
        userProfile.style.display = 'flex';
        profileActions.style.display = 'flex';
    }
}

// Handle message submission
function handleMessageSubmit(e) {
    e.preventDefault();
    
    const message = input.value.trim();
    if (message && currentUser && isConnected) {
        socket.emit('chat message', {
            content: message,
            timestamp: new Date().toISOString()
        });
        
        input.value = '';
        document.getElementById('inputCounter').textContent = '0';
        stopTyping();
    } else if (!isConnected) {
        showToast('Not connected to server', 'error');
    } else if (!currentUser) {
        showToast('Please set up your profile first', 'error');
    }
}

// Handle key press for better UX
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleMessageSubmit(e);
    }
}

// Handle typing indicator
function handleTyping() {
    if (currentUser && isConnected) {
        socket.emit('typing');
        
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            socket.emit('stop typing');
        }, 1000);
    }
}

function stopTyping() {
    if (currentUser && isConnected) {
        socket.emit('stop typing');
        clearTimeout(typingTimer);
    }
}

// Update character counter
function updateCharCounter() {
    const textarea = document.getElementById('anonymousMessage');
    const counter = document.getElementById('charCount');
    counter.textContent = textarea.value.length;
    
    if (textarea.value.length > 800) {
        counter.style.color = 'var(--error)';
    } else {
        counter.style.color = 'var(--text)';
    }
}

// Send anonymous message
function sendAnonymousMessage() {
    const profileUrlInput = document.getElementById('profileUrlInput').value.trim();
    const messageContent = document.getElementById('anonymousMessage').value.trim();
    
    if (!profileUrlInput || !messageContent) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (messageContent.length > 1000) {
        showToast('Message too long (max 1000 characters)', 'error');
        return;
    }
    
    // Extract profile URL from full URL if necessary
    let profileUrl = profileUrlInput;
    if (profileUrlInput.includes('/to/')) {
        profileUrl = profileUrlInput.split('/to/')[1];
    }
    
    if (!isConnected) {
        showToast('Not connected to server', 'error');
        return;
    }
    
    const sendBtn = document.getElementById('sendAnonymousBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    socket.emit('anonymous message', {
        profileUrl: profileUrl,
        content: messageContent
    });
}

// Load inbox messages
function loadInboxMessages() {
    if (isConnected && currentUser) {
        socket.emit('refresh inbox');
    }
    updateInboxDisplay();
}

// Update inbox display
function updateInboxDisplay() {
    const emptyState = document.getElementById('emptyInbox');
    const inboxCountElement = document.getElementById('inboxCount');
    const inboxBadge = document.getElementById('inboxBadge');
    
    if (inboxCount === 0) {
        emptyState.style.display = 'flex';
        inboxCountElement.style.display = 'none';
        inboxBadge.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        inboxCountElement.style.display = 'inline-block';
        inboxCountElement.textContent = inboxCount;
        inboxBadge.style.display = 'inline-block';
        inboxBadge.textContent = inboxCount;
    }
}

// Share functions
function copyProfileLink() {
    const shareLink = document.getElementById('shareLink');
    if (shareLink.value) {
        navigator.clipboard.writeText(shareLink.value).then(() => {
            showToast('Profile link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            shareLink.select();
            document.execCommand('copy');
            showToast('Profile link copied to clipboard!', 'success');
        });
    } else {
        showToast('No profile link to copy', 'error');
    }
}

function shareOnWhatsApp() {
    const shareLink = document.getElementById('shareLink').value;
    if (shareLink) {
        const text = `Send me an anonymous message: ${shareLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
}

function shareOnTwitter() {
    const shareLink = document.getElementById('shareLink').value;
    if (shareLink) {
        const text = `Send me an anonymous message: ${shareLink}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
}

function shareOnFacebook() {
    const shareLink = document.getElementById('shareLink').value;
    if (shareLink) {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`, '_blank');
    }
}

// Paste from clipboard
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('profileUrlInput').value = text;
        showToast('Pasted from clipboard', 'success');
    } catch (err) {
        showToast('Failed to paste from clipboard', 'error');
    }
}

// Utility functions
function refreshInbox() {
    if (isConnected && currentUser) {
        socket.emit('refresh inbox');
        showToast('Refreshing inbox...', 'info');
    } else {
        showToast('Not connected to server', 'error');
    }
}

function refreshChat() {
    if (isConnected) {
        showToast('Refreshing chat...', 'info');
        // Messages will be automatically updated via socket
    } else {
        showToast('Not connected to server', 'error');
    }
}

function clearChat() {
    if (confirm('Are you sure you want to clear the chat? This will only clear it for you.')) {
        const welcomeMessage = messages.querySelector('.welcome-message');
        messages.innerHTML = '';
        if (welcomeMessage) {
            messages.appendChild(welcomeMessage);
        }
        messageCount = 0;
        updateMessageCount();
        showToast('Chat cleared', 'info');
    }
}

function clearInbox() {
    if (confirm('Are you sure you want to clear your inbox? This cannot be undone.')) {
        if (isConnected && currentUser) {
            socket.emit('clear inbox');
        }
        inboxMessages.innerHTML = '';
        inboxCount = 0;
        updateInboxDisplay();
        showToast('Inbox cleared', 'info');
    }
}

function showHelp() {
    showToast('Copy someone\'s profile link and paste it here to send anonymous messages', 'info');
}

function updateMessageCount() {
    document.getElementById('messageCount').textContent = messageCount;
}

// Show toast notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Enhanced socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    reconnectAttempts = 0;
    updateConnectionStatus('connected');
    hideLoadingOverlay();
    
    if (currentUser) {
        socket.emit('user connected', currentUser);
        showToast('Reconnected to server', 'success');
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    isConnected = false;
    updateConnectionStatus('disconnected');
    
    if (reason === 'io server disconnect') {
        showToast('Disconnected by server', 'error');
    } else {
        showToast('Connection lost. Reconnecting...', 'error');
        updateConnectionStatus('reconnecting');
    }
});

socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    updateConnectionStatus('reconnecting');
    showToast(`Reconnecting... (${attemptNumber}/5)`, 'info');
});

socket.on('reconnect_failed', () => {
    showToast('Failed to reconnect. Please refresh the page.', 'error');
    updateConnectionStatus('disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    showToast('Connection error. Please check your internet.', 'error');
    updateConnectionStatus('disconnected');
    hideLoadingOverlay();
});

socket.on('user count', (count) => {
    userCountSpan.textContent = count;
});

socket.on('profile created', (data) => {
    profileUrl = data.profileUrl;
    console.log('Profile created:', data);
});

socket.on('profile url', (data) => {
    profileUrl = data.profileUrl;
});

socket.on('user joined', (data) => {
    showToast(`${data.username} joined the community`, 'info');
});

socket.on('user left', (data) => {
    showToast(`${data.username} left the community`, 'info');
});

socket.on('chat message', (data) => {
    addMessageToChat(data);
    messageCount++;
    updateMessageCount();
});

socket.on('community messages', (messages) => {
    const messagesContainer = document.getElementById('messages');
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    messagesContainer.innerHTML = '';
    
    if (welcomeMessage) {
        messagesContainer.appendChild(welcomeMessage);
    }
    
    messages.forEach(message => {
        addMessageToChat(message);
    });
    
    messageCount = messages.length;
    updateMessageCount();
});

socket.on('inbox messages', (messages) => {
    inboxMessages.innerHTML = '';
    messages.forEach(message => {
        addMessageToInbox(message);
    });
    inboxCount = messages.length;
    updateInboxDisplay();
});

socket.on('new message', (message) => {
    addMessageToInbox(message);
    inboxCount++;
    updateInboxDisplay();
    
    if (currentView !== 'inbox') {
        showToast('New anonymous message received!', 'info');
    }
});

socket.on('message sent', (data) => {
    const sendBtn = document.getElementById('sendAnonymousBtn');
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Anonymous Message';
    
    document.getElementById('anonymousMessage').value = '';
    document.getElementById('profileUrlInput').value = '';
    updateCharCounter();
    
    showToast(data.message || 'Message sent successfully!', 'success');
});

socket.on('message error', (error) => {
    const sendBtn = document.getElementById('sendAnonymousBtn');
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Anonymous Message';
    
    showToast(error, 'error');
});

socket.on('user typing', (username) => {
    if (currentView === 'community') {
        typingIndicator.textContent = `${username} is typing...`;
    }
});

socket.on('user stopped typing', () => {
    typingIndicator.textContent = '';
});

socket.on('message deleted', (messageId) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
        messageCount--;
        updateMessageCount();
    }
});

socket.on('connection error', (error) => {
    showToast(error, 'error');
    hideLoadingOverlay();
});

// Add message to community chat
function addMessageToChat(data) {
    const item = document.createElement('li');
    item.dataset.messageId = data.id;
    item.className = 'fade-in';
    
    const isUserMessage = currentUser && data.username === currentUser.username;
    item.classList.add(isUserMessage ? 'user-message' : 'other-message');
    
    const time = new Date(data.timestamp).toLocaleTimeString();
    
    item.innerHTML = `
        <div class="message-sender">${escapeHtml(data.username)}</div>
        <div class="message-content">${escapeHtml(data.content)}</div>
        <div class="message-time">${time}</div>
        ${isUserMessage ? `<button class="delete-btn" onclick="deleteMessage('${data.id}')" title="Delete message">×</button>` : ''}
    `;
    
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    
    // Auto-scroll to bottom
    setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
    }, 100);
}

// Add message to inbox
function addMessageToInbox(data) {
    const item = document.createElement('li');
    item.dataset.messageId = data.id;
    item.className = 'anonymous-message fade-in';
    
    const time = new Date(data.timestamp).toLocaleTimeString();
    
    item.innerHTML = `
        <div class="message-sender">${escapeHtml(data.from)}</div>
        <div class="message-content">${escapeHtml(data.content)}</div>
        <div class="message-time">${time}</div>
        <button class="delete-btn" onclick="deleteMessage('${data.id}')" title="Delete message">×</button>
    `;
    
    inboxMessages.appendChild(item);
    inboxMessages.scrollTop = inboxMessages.scrollHeight;
}

// Delete message
function deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
        socket.emit('delete message', messageId);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle window resize for mobile
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
    }
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        closeShareModal();
    }
    if (e.target === profileModal) {
        // Don't close profile modal by clicking outside initially
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape key closes modals
    if (e.key === 'Escape') {
        if (shareModal.style.display === 'block') {
            closeShareModal();
        }
        if (document.getElementById('emojiPicker').style.display === 'block') {
            document.getElementById('emojiPicker').style.display = 'none';
        }
    }
    
    // Ctrl/Cmd + Enter sends message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (currentView === 'community' && input.value.trim()) {
            handleMessageSubmit(e);
        }
    }
});

// Make functions globally accessible
window.switchView = switchView;
window.closeShareModal = closeShareModal;
window.showShareModal = showShareModal;
window.deleteMessage = deleteMessage;
