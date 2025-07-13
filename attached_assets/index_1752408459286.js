const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Track users and typing status
const users = new Map(); // socket.id -> { id, username, profilePic }
const typingUsers = new Set();
const onlineUsers = new Set();

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/to:username', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Handle profile picture uploads
app.post('/upload-profile-pic', upload.single('profilePic'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ 
    success: true, 
    url: '/uploads/' + req.file.filename 
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('a user connected');
  
  // Update user count for everyone
  updateUserCount();
  
  // User connected with profile
  socket.on('user connected', (userData) => {
    users.set(socket.id, userData);
    onlineUsers.add(userData.id);
    io.emit('user joined', userData.username);
    updateUserCount();
  });
  
  // Handle community chat messages
  socket.on('chat message', (data) => {
    // Add unique ID to the message
    data.id = Date.now().toString();
    
    // Broadcast the message to all clients
    io.emit('chat message', data);
    
    // Remove typing indicator if present
    const user = users.get(socket.id);
    if (user && typingUsers.has(user.username)) {
      typingUsers.delete(user.username);
      io.emit('user stopped typing');
    }
  });
  
  // Handle typing indicator
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user && !typingUsers.has(user.username)) {
      typingUsers.add(user.username);
      io.emit('user typing', user.username);
    }
  });
  
  // Handle stop typing
  socket.on('stop typing', () => {
    const user = users.get(socket.id);
    if (user && typingUsers.has(user.username)) {
      typingUsers.delete(user.username);
      io.emit('user stopped typing');
    }
  });
  
  // Handle profile updates
  socket.on('update profile', (userData) => {
    users.set(socket.id, userData);
    io.emit('profile updated', userData);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      onlineUsers.delete(user.id);
      io.emit('user left', user.username);
      updateUserCount();
      
      // Remove from typing users if present
      if (typingUsers.has(user.username)) {
        typingUsers.delete(user.username);
        io.emit('user stopped typing');
      }
    }
    console.log('user disconnected');
  });
});

function updateUserCount() {
  io.emit('user count', users.size);
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

server.listen(3000, () => {
  console.log('listening on *:3000');
});