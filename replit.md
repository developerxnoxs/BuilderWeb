# Android Studio Web - Build Real Android Apps

A powerful web-based IDE for building real Android applications using React Native, Flutter, and Capacitor. This platform provides a professional development environment with Monaco Editor (VSCode engine), real-time builds, and integration with a Debian GPU server for compilation.

## Project Overview

**Tech Stack:**
- **Frontend:** React, TypeScript, TailwindCSS, Shadcn UI
- **Editor:** Monaco Editor (@monaco-editor/react)
- **Backend:** Express.js, TypeScript
- **Real-time:** WebSocket for build logs
- **Storage:** In-memory storage (MemStorage)
- **State Management:** TanStack Query (React Query v5)

## Architecture

### Frontend
- **Dashboard:** Project overview with stats and recent projects
- **Projects:** List and manage all projects with filters
- **Templates:** Browse and use pre-built project templates
- **Editor:** Full IDE experience with Monaco editor, file tree, and build panel
- **Builds:** Build history and APK downloads
- **Settings:** Configure Debian server connection

### Backend
- **Project Management:** CRUD operations for projects ✅
- **File System:** Virtual file system for project files ✅
- **Build Queue:** Submit builds to Debian server ✅
- **WebSocket:** Real-time build log streaming ✅
- **Templates:** Pre-configured project templates ✅

### External Integration - Debian Build Server
- **Production APK Compilation:** Real Android APK compilation using Android SDK ✅
- **React Native:** npm install → react-native bundle → gradlew assembleRelease → APK signing
- **Flutter:** flutter pub get → flutter build apk → APK signing
- **Capacitor:** npm install → npm run build → cap sync → gradlew assembleRelease → APK signing
- **APK Signing:** Automatic keystore generation and apksigner (zipalign → sign → verify)
- **Real-time Logs:** Build progress streaming via WebSocket

## Data Models

### Project
- `id`: Unique identifier
- `name`: Project name
- `description`: Project description
- `framework`: react-native | flutter | capacitor
- `status`: active | building | archived
- `createdAt`, `lastModified`: Timestamps

### File
- `id`: Unique identifier
- `projectId`: Reference to project
- `path`: Relative file path
- `content`: File content
- `type`: file | folder
- `language`: Programming language

### BuildJob
- `id`: Unique identifier
- `projectId`: Reference to project
- `status`: pending | queued | building | success | failed
- `logs`: Array of log entries
- `apkUrl`: Download URL for built APK
- `errorMessage`: Build error if failed

### Template
- `id`: Unique identifier
- `name`: Template name
- `description`: Template description
- `framework`: Target framework
- `files`: Template file structure

## Features

### Current (MVP)
✅ Monaco code editor with syntax highlighting
✅ File tree explorer with expand/collapse
✅ Multi-tab file editing
✅ Project dashboard with real statistics
✅ Template system for quick project creation
✅ Build status panel with real-time logs
✅ Dark/Light theme support
✅ Responsive design
✅ Settings for server configuration

**Git Integration:**
✅ Commit tracking with author and message
✅ Git history and branch management
✅ Git status and uncommitted changes tracking

**Project Management:**
✅ Project duplication
✅ Project export as ZIP
✅ Project import from ZIP
✅ Project-specific build settings
✅ Advanced search and filtering

**File Operations:**
✅ File rename/move functionality
✅ File upload for assets (images, fonts, audio)
✅ Batch file operations (create/delete multiple)
✅ Search within file contents

**Build Features:**
✅ Build cancellation
✅ Real-time WebSocket build updates
✅ Build queue management
✅ APK download

### Production Build System (October 2025)
✅ **Real APK Compilation Implemented**
- Android SDK integration with proper environment setup
- Flutter SDK support (3.24.5+)
- React Native CLI with Watchman
- Automatic APK signing with keystore generation
- Build verification (apksigner verify)
- Production-ready setup scripts

**Setup Scripts Available:**
- `debian-server/setup-android-sdk.sh` - Install Android SDK, Build Tools, Platform Tools
- `debian-server/setup-flutter.sh` - Install Flutter SDK
- `debian-server/setup-react-native.sh` - Install React Native CLI & Watchman
- `debian-server/keystore-generator.ts` - Automatic keystore management

**Documentation:**
- `PRODUCTION_SETUP.md` - Complete production setup guide
- `DEBIAN_SERVER_SETUP.md` - Server configuration and deployment

### Future Enhancements
- GitHub remote push/pull integration
- Visual UI builder (drag-and-drop)
- AI code assistant
- Collaborative editing
- Android emulator preview
- Automated testing
- CI/CD pipeline
- Gradle dependency caching for faster builds
- Multiple build server load balancing

## User Flow

1. **Get Started:** User visits dashboard
2. **Create Project:** Choose from templates (React Native, Flutter, Capacitor)
3. **Edit Code:** Use Monaco editor with file tree navigation
4. **Build App:** Click "Build APK" to submit to Debian server
5. **Monitor Progress:** Watch real-time build logs
6. **Download APK:** Download completed Android application

## Server Configuration

Users need to configure their Debian server in Settings:
- **Server URL:** HTTP/HTTPS endpoint for build server
- **API Key:** Authentication for secure communication

## Development

### Local Development
```bash
npm install
npm run dev
```

The app runs on port 5000 with hot reload enabled.

### Environment Variables
- `SESSION_SECRET`: Session management (already configured)
- Server URL and API Key stored in localStorage (client-side)

## Design Philosophy

Following Material Design 3 principles with IDE-specific customizations:
- **Dark-first interface** for developer comfort
- **Information density** without clutter
- **Professional aesthetics** inspired by VS Code and Android Studio
- **Consistent spacing and typography**
- **Smooth interactions** with subtle hover/active states

## Notes

- Monaco Editor provides VSCode-level editing experience
- File tree supports nested folder structures
- Build system designed to work with external Debian GPU server
- Real-time WebSocket communication for build logs
- Responsive layout optimized for desktop developers (1920x1080+)
