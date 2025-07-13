# UI Anonymous Community Chat Application

## Overview

This is a real-time anonymous messaging application built for University of Ibadan students. The application enables users to send anonymous messages, share profiles, and participate in a community chat environment. It features a modern web interface with Socket.io for real-time communication and file upload capabilities for profile pictures.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a client-server architecture with real-time bidirectional communication:

- **Frontend**: Static HTML/CSS/JavaScript served by Express.js
- **Backend**: Node.js with Express.js server
- **Real-time Communication**: Socket.io for WebSocket connections
- **File Storage**: Local disk storage using Multer
- **Static Assets**: Served directly by Express.js

## Key Components

### Backend Components

1. **Express.js Server (`server.js`)**
   - Serves static files from the `public` directory
   - Handles HTTP requests and file uploads
   - Implements CORS middleware for cross-origin requests
   - Configures Socket.io for real-time communication

2. **Socket.io Integration**
   - Manages real-time messaging between clients
   - Handles user connections and disconnections
   - Supports typing indicators and online user tracking
   - Implements CORS configuration for cross-browser compatibility

3. **File Upload System**
   - Uses Multer for handling profile picture uploads
   - Stores files in `public/uploads/` directory
   - Generates unique filenames with timestamps
   - Serves uploaded files as static assets

### Frontend Components

1. **Main Interface (`public/index.html`)**
   - Responsive design with mobile menu support
   - Profile management system
   - Community chat interface
   - Connection status indicators

2. **Client-side JavaScript (`public/script.js`)**
   - Socket.io client implementation
   - Real-time message handling
   - Profile sharing functionality
   - Typing indicators and user management

3. **Styling (`public/style.css`)**
   - Modern CSS with custom properties
   - Responsive design with animations
   - UI-themed color scheme (gold/green)
   - Mobile-first approach

## Data Flow

1. **User Connection**
   - Client connects via Socket.io
   - Server tracks online users
   - Connection status updates in real-time

2. **Message Flow**
   - Messages sent through Socket.io events
   - Real-time broadcast to all connected clients
   - No persistent storage (messages are ephemeral)

3. **Profile Management**
   - Profile pictures uploaded via HTTP POST
   - Files stored locally and served as static assets
   - Profile sharing through URL generation

4. **File Upload Process**
   - Client uploads profile picture via form submission
   - Multer processes file and stores in uploads directory
   - Server returns file URL for client use

## External Dependencies

### Core Dependencies
- **express**: Web framework for Node.js
- **socket.io**: Real-time bidirectional event-based communication
- **multer**: Middleware for handling multipart/form-data (file uploads)

### Frontend Dependencies
- **Font Awesome**: Icon library loaded via CDN
- **Socket.io Client**: Loaded from Socket.io server

## Deployment Strategy

The application is designed for simple deployment:

1. **Development**: Uses `npm start` to run the server
2. **Static File Serving**: All frontend assets served from `public/` directory
3. **File Storage**: Local disk storage for uploaded files
4. **Port Configuration**: Defaults to process.env.PORT or standard port
5. **CORS Configuration**: Allows all origins for development/testing

### Key Architectural Decisions

**Problem**: Real-time messaging requirements
**Solution**: Socket.io for WebSocket communication
**Rationale**: Provides reliable real-time communication with fallback to polling

**Problem**: File upload handling
**Solution**: Multer with local disk storage
**Rationale**: Simple implementation for profile pictures without external dependencies

**Problem**: Anonymous messaging
**Solution**: No persistent user authentication or message storage
**Rationale**: Maintains anonymity while providing real-time communication

**Problem**: Cross-browser compatibility
**Solution**: Comprehensive CORS configuration and preflight handling
**Rationale**: Ensures functionality across different browsers and development environments

**Pros of Current Architecture**:
- Simple deployment and maintenance
- Real-time communication capabilities
- No database dependency
- Lightweight and fast

**Cons of Current Architecture**:
- No message persistence
- No user authentication
- Limited scalability for high traffic
- Files stored locally (not suitable for distributed deployment)