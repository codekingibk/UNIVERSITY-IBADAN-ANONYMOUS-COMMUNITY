const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    credentials: true
  }
});
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Enhanced CORS middleware for cross-browser compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
      'image/jpg', 'image/svg+xml'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Serve static files with proper headers
app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced in-memory storage with better data structure
const users = new Map(); // socket.id -> user data
const userProfiles = new Map(); // profileUrl -> user data
const privateMessages = new Map(); // userId -> { inbox: [], sent: [] }
const communityMessages = []; // Community chat messages (last 200)
const typingUsers = new Set(); // Currently typing users
const onlineUsers = new Set(); // Online user IDs
const userSessions = new Map(); // userId -> socket.id for quick lookup

// Enhanced profile URL generation with collision detection
function generateProfileUrl(username) {
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomId = Math.random().toString(36).substr(2, 8);
  const timestamp = Date.now().toString(36);
  let profileUrl = `${cleanUsername}-${randomId}${timestamp}`;
  
  // Ensure uniqueness
  let counter = 0;
  while (userProfiles.has(profileUrl)) {
    counter++;
    profileUrl = `${cleanUsername}-${randomId}${timestamp}${counter}`;
  }
  
  return profileUrl;
}

// Utility function to extract profile URL from various input formats
function extractProfileUrl(input) {
  if (!input) return null;
  
  // Remove whitespace
  input = input.trim();
  
  // If it's a full URL, extract the profile part
  if (input.includes('/to/')) {
    const parts = input.split('/to/');
    return parts[1] ? parts[1].split('?')[0].split('#')[0] : null;
  }
  
  // If it starts with 'to/', remove it
  if (input.startsWith('to/')) {
    return input.substring(3);
  }
  
  // Return as-is if it looks like a profile URL
  return input;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced profile link route with better error handling
app.get('/to/:profileUrl', (req, res) => {
  const profileUrl = req.params.profileUrl;
  const profile = userProfiles.get(profileUrl);
  
  if (!profile) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Not Found - UI Anonymous</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #121230 100%);
            color: #e0e0ff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .container {
            text-align: center;
            background: rgba(26, 26, 58, 0.9);
            padding: 3rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(234, 163, 6, 0.3);
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
          }
          .error-icon {
            font-size: 4rem;
            color: #ff4d4d;
            margin-bottom: 1rem;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          h1 {
            color: #eaa306;
            margin-bottom: 1rem;
            font-size: 2rem;
          }
          p {
            margin-bottom: 2rem;
            opacity: 0.9;
            line-height: 1.6;
          }
          .btn {
            background: linear-gradient(45deg, #eaa306, #006341);
            color: #0a0a1a;
            padding: 1rem 2rem;
            border: none;
            border-radius: 2rem;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
            font-size: 1rem;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(234, 163, 6, 0.4);
          }
          .info-text {
            background: rgba(255, 255, 255, 0.05);
            padding: 1rem;
            border-radius: 0.75rem;
            margin-top: 1.5rem;
            border-left: 4px solid #eaa306;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">
            <i class="fas fa-user-slash"></i>
          </div>
          <h1>Profile Not Found</h1>
          <p>The profile you're looking for doesn't exist or the user is currently offline.</p>
          <div class="info-text">
            <strong>Tip:</strong> Profile links are only active when the user is online. Ask them to share their link again.
          </div>
          <a href="/" class="btn">
            <i class="fas fa-comments"></i>
            Join Community
          </a>
        </div>
      </body>
      </html>
    `);
  }
  
  // Redirect to main page with profile parameter
  res.redirect(`/?to=${profileUrl}`);
});

// Enhanced profile picture upload with better validation
app.post('/upload-profile-pic', upload.single('profilePic'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    res.json({ 
      success: true, 
      url: '/uploads/' + req.file.filename,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    users: users.size,
    messages: communityMessages.length
  });
});

// Socket.io connection handling with enhanced error handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send current user count
  updateUserCount();
  
  // Handle user connection with profile
  socket.on('user connected', (userData) => {
    try {
      // Validate user data
      if (!userData || !userData.username || userData.username.length < 3) {
        socket.emit('connection error', 'Invalid username. Must be at least 3 characters.');
        return;
      }
      
      // Check if username is already taken
      const existingUser = Array.from(users.values()).find(u => u.username === userData.username);
      if (existingUser) {
        socket.emit('connection error', 'Username already taken. Please choose another.');
        return;
      }
      
      const profileUrl = generateProfileUrl(userData.username);
      const userProfile = {
        id: userData.id,
        username: userData.username,
        profilePic: userData.profilePic || 'https://via.placeholder.com/50x50/eaa306/0a0a1a?text=U',
        profileUrl: profileUrl,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      
      // Store user data
      users.set(socket.id, userProfile);
      userProfiles.set(profileUrl, userProfile);
      userSessions.set(userData.id, socket.id);
      onlineUsers.add(userData.id);
      
      // Initialize user's message storage
      if (!privateMessages.has(userData.id)) {
        privateMessages.set(userData.id, { inbox: [], sent: [] });
      }
      
      // Send profile data to user
      socket.emit('profile created', { 
        profileUrl: profileUrl,
        fullUrl: `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/to/${profileUrl}`
      });
      
      // Notify others
      socket.broadcast.emit('user joined', {
        username: userData.username,
        profilePic: userData.profilePic
      });
      
      updateUserCount();
      
      // Send existing community messages (last 50)
      socket.emit('community messages', communityMessages.slice(-50));
      
      // Send user's inbox messages
      const userMessages = privateMessages.get(userData.id);
      if (userMessages && userMessages.inbox.length > 0) {
        socket.emit('inbox messages', userMessages.inbox);
      }
      
      console.log(`User ${userData.username} connected with profile URL: ${profileUrl}`);
      
    } catch (error) {
      console.error('Error handling user connection:', error);
      socket.emit('connection error', 'Failed to connect user. Please try again.');
    }
  });
  
  // Handle community chat messages
  socket.on('chat message', (data) => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit('message error', 'User not found. Please reconnect.');
      return;
    }
    
    try {
      // Validate message content
      if (!data.content || data.content.trim().length === 0) {
        socket.emit('message error', 'Message cannot be empty.');
        return;
      }
      
      if (data.content.length > 1000) {
        socket.emit('message error', 'Message too long. Maximum 1000 characters.');
        return;
      }
      
      const message = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        username: user.username,
        profilePic: user.profilePic,
        content: data.content.trim(),
        timestamp: new Date().toISOString(),
        type: 'community'
      };
      
      // Store in community messages (keep last 200)
      communityMessages.push(message);
      if (communityMessages.length > 200) {
        communityMessages.shift();
      }
      
      // Broadcast to all users
      io.emit('chat message', message);
      
      // Clear typing indicator
      if (typingUsers.has(user.username)) {
        typingUsers.delete(user.username);
        io.emit('user stopped typing');
      }
      
      // Update user's last seen
      user.lastSeen = new Date().toISOString();
      
    } catch (error) {
      console.error('Error handling chat message:', error);
      socket.emit('message error', 'Failed to send message. Please try again.');
    }
  });
  
  // Enhanced anonymous message handling
  socket.on('anonymous message', (data) => {
    try {
      const { profileUrl, content } = data;
      
      // Validate input
      if (!profileUrl || !content) {
        socket.emit('message error', 'Profile URL and message content are required.');
        return;
      }
      
      if (content.length > 1000) {
        socket.emit('message error', 'Message too long. Maximum 1000 characters.');
        return;
      }
      
      // Extract and validate profile URL
      const cleanProfileUrl = extractProfileUrl(profileUrl);
      if (!cleanProfileUrl) {
        socket.emit('message error', 'Invalid profile URL format.');
        return;
      }
      
      // Find target user
      const targetProfile = userProfiles.get(cleanProfileUrl);
      if (!targetProfile) {
        socket.emit('message error', 'User not found or currently offline. They need to be online to receive messages.');
        return;
      }
      
      // Check if user is trying to send message to themselves
      const sender = users.get(socket.id);
      if (sender && sender.profileUrl === cleanProfileUrl) {
        socket.emit('message error', 'You cannot send anonymous messages to yourself.');
        return;
      }
      
      const message = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        from: 'Anonymous',
        to: targetProfile.username,
        toId: targetProfile.id,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        type: 'anonymous',
        profileUrl: cleanProfileUrl
      };
      
      // Store in recipient's inbox
      const recipientMessages = privateMessages.get(targetProfile.id);
      if (recipientMessages) {
        recipientMessages.inbox.push(message);
        
        // Keep only last 100 messages per user
        if (recipientMessages.inbox.length > 100) {
          recipientMessages.inbox.shift();
        }
      }
      
      // Send to recipient if online
      const recipientSocketId = userSessions.get(targetProfile.id);
      if (recipientSocketId && users.has(recipientSocketId)) {
        io.to(recipientSocketId).emit('new message', message);
      }
      
      // Confirm to sender
      socket.emit('message sent', {
        success: true,
        message: `Anonymous message sent to ${targetProfile.username}`,
        timestamp: message.timestamp
      });
      
      console.log(`Anonymous message sent to ${targetProfile.username} from ${socket.id}`);
      
    } catch (error) {
      console.error('Error handling anonymous message:', error);
      socket.emit('message error', 'Failed to send anonymous message. Please try again.');
    }
  });
  
  // Handle typing indicators
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user && !typingUsers.has(user.username)) {
      typingUsers.add(user.username);
      socket.broadcast.emit('user typing', user.username);
    }
  });
  
  socket.on('stop typing', () => {
    const user = users.get(socket.id);
    if (user && typingUsers.has(user.username)) {
      typingUsers.delete(user.username);
      socket.broadcast.emit('user stopped typing');
    }
  });
  
  // Handle profile updates
  socket.on('update profile', (userData) => {
    const user = users.get(socket.id);
    if (user) {
      try {
        // Validate new username
        if (userData.username && userData.username !== user.username) {
          const existingUser = Array.from(users.values()).find(u => 
            u.username === userData.username && u.socketId !== socket.id
          );
          if (existingUser) {
            socket.emit('message error', 'Username already taken.');
            return;
          }
        }
        
        const updatedProfile = {
          ...user,
          username: userData.username || user.username,
          profilePic: userData.profilePic || user.profilePic,
          lastSeen: new Date().toISOString()
        };
        
        users.set(socket.id, updatedProfile);
        userProfiles.set(user.profileUrl, updatedProfile);
        
        socket.broadcast.emit('profile updated', updatedProfile);
        socket.emit('profile updated', updatedProfile);
        
      } catch (error) {
        console.error('Error updating profile:', error);
        socket.emit('message error', 'Failed to update profile.');
      }
    }
  });
  
  // Handle message deletion
  socket.on('delete message', (messageId) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    try {
      // Remove from community messages (only if sender)
      const messageIndex = communityMessages.findIndex(msg => 
        msg.id === messageId && msg.username === user.username
      );
      if (messageIndex !== -1) {
        communityMessages.splice(messageIndex, 1);
        io.emit('message deleted', messageId);
        return;
      }
      
      // Remove from user's inbox
      const userMessages = privateMessages.get(user.id);
      if (userMessages) {
        const inboxIndex = userMessages.inbox.findIndex(msg => msg.id === messageId);
        if (inboxIndex !== -1) {
          userMessages.inbox.splice(inboxIndex, 1);
          socket.emit('message deleted', messageId);
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('message error', 'Failed to delete message.');
    }
  });
  
  // Handle profile URL requests
  socket.on('get profile url', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.emit('profile url', {
        profileUrl: user.profileUrl,
        fullUrl: `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/to/${user.profileUrl}`
      });
    }
  });
  
  // Handle inbox refresh
  socket.on('refresh inbox', () => {
    const user = users.get(socket.id);
    if (user) {
      const userMessages = privateMessages.get(user.id);
      if (userMessages) {
        socket.emit('inbox messages', userMessages.inbox);
      } else {
        socket.emit('inbox messages', []);
      }
    }
  });
  
  // Handle clear inbox
  socket.on('clear inbox', () => {
    const user = users.get(socket.id);
    if (user) {
      const userMessages = privateMessages.get(user.id);
      if (userMessages) {
        userMessages.inbox = [];
        socket.emit('inbox messages', []);
      }
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      try {
        // Clean up user data
        users.delete(socket.id);
        userProfiles.delete(user.profileUrl);
        userSessions.delete(user.id);
        onlineUsers.delete(user.id);
        
        // Notify others
        socket.broadcast.emit('user left', {
          username: user.username,
          profilePic: user.profilePic
        });
        
        updateUserCount();
        
        // Remove from typing users
        if (typingUsers.has(user.username)) {
          typingUsers.delete(user.username);
          socket.broadcast.emit('user stopped typing');
        }
        
        console.log(`User ${user.username} disconnected`);
        
      } catch (error) {
        console.error('Error handling user disconnection:', error);
      }
    }
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('message error', 'Connection error occurred.');
  });
});

// Update user count
function updateUserCount() {
  const count = users.size;
  io.emit('user count', count);
}

// Cleanup inactive users (run every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  for (const [socketId, user] of users.entries()) {
    const lastSeen = new Date(user.lastSeen).getTime();
    if (lastSeen < fiveMinutesAgo) {
      // Remove inactive user
      users.delete(socketId);
      userProfiles.delete(user.profileUrl);
      userSessions.delete(user.id);
      onlineUsers.delete(user.id);
      
      if (typingUsers.has(user.username)) {
        typingUsers.delete(user.username);
      }
      
      console.log(`Cleaned up inactive user: ${user.username}`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// Create necessary directories
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server on port 5000 for proper external access
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UI Anonymous Community Server running on port ${PORT}`);
  console.log(`🌐 Access the app at: http://localhost:${PORT}`);
  console.log(`📱 External URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
});
