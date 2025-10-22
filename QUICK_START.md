# Quick Start Guide - Android Studio Web

Panduan cepat untuk menjalankan Android Studio Web dengan Debian Build Server.

## 🚀 Setup Otomatis

### 1. Jalankan Script Setup

```bash
bash scripts/setup-debian-server.sh
```

Script ini akan:
- ✅ Membuat direktori build yang diperlukan
- ✅ Generate API key otomatis
- ✅ Membuat file `.env` dengan konfigurasi lengkap
- ✅ Install dependencies
- ✅ Setup database schema
- ✅ Membuat script startup

### 2. Start Semua Services

```bash
bash scripts/start-all.sh
```

Atau start secara manual:

```bash
# Terminal 1: Main Server
npm run dev

# Terminal 2: Debian Build Server  
npm run debian:dev
```

### 3. Konfigurasi Frontend

1. Buka browser ke http://localhost:5000
2. Klik menu **Settings** di sidebar
3. Masukkan konfigurasi:
   - **Server URL**: `http://localhost:3001`
   - **API Key**: (lihat output dari setup script atau file `.env`)

### 4. Test Build

1. Klik "New Project" di Dashboard
2. Pilih template (React Native / Flutter / Capacitor)
3. Beri nama project
4. Klik "Build APK"
5. Monitor progress di Build Status Panel
6. Download APK setelah selesai

## 📋 Requirements

- Node.js 20+
- PostgreSQL (otomatis disediakan oleh Replit)
- Linux/Debian (untuk production builds)

## 🔧 Konfigurasi Manual

Jika ingin konfigurasi manual, copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit `.env` dan sesuaikan:

```env
# Main Server
PORT=5000
NODE_ENV=development

# Debian Build Server
DEBIAN_SERVER_PORT=3001
DEBIAN_API_KEY=your-api-key-here

# Database (otomatis dari Replit)
DATABASE_URL=your-database-url
```

## 📡 API Endpoints

### Main Server (Port 5000)
- Frontend aplikasi
- API untuk projects, files, builds
- WebSocket untuk real-time updates
- Git integration endpoints

### Debian Build Server (Port 3001)
- `/health` - Health check
- `/api/builds` - Submit dan manage builds
- `/api/builds/:id` - Build status
- `/api/builds/:id/download` - Download APK

## 🐛 Troubleshooting

### Port sudah digunakan
```bash
# Check process menggunakan port
lsof -i :5000
lsof -i :3001

# Kill process jika perlu
kill -9 <PID>
```

### Database error
```bash
# Re-push database schema
npm run db:push
```

### Frontend tidak bisa connect ke build server
1. Pastikan build server running di port 3001
2. Check API key di Settings match dengan `.env`
3. Verify URL: `http://localhost:3001` (bukan https)

### Build gagal
1. Check Debian server logs
2. Verify disk space tersedia
3. Check file permissions di folder `builds/` dan `apks/`

## 📚 Fitur yang Tersedia

### ✅ Project Management
- Create, read, update, delete projects
- Project templates (React Native, Flutter, Capacitor)
- Project duplication
- Project search dan filtering

### ✅ File Management
- File tree navigation
- Monaco code editor (VSCode engine)
- File create, edit, delete
- File rename/move
- Multi-tab editing

### ✅ Build System
- Submit build ke Debian server
- Real-time build logs via WebSocket
- Build queue management
- Build cancellation
- APK download
- Build history

### ✅ Git Integration
- Initialize repository
- Create commits
- View commit history
- Branch management
- Git status

### ✅ Dashboard
- Real-time statistics
- Recent projects
- Active builds count
- Success rate

## 🔐 Security Notes

### Development
- Default API key aman untuk development
- Database lokal di Replit

### Production
1. **Ganti API Key**: Generate API key yang kuat
2. **HTTPS**: Gunakan reverse proxy (nginx/caddy)
3. **Firewall**: Restrict akses ke build server
4. **Environment**: Set `NODE_ENV=production`
5. **Secrets**: Jangan commit `.env` ke git

## 📖 Dokumentasi Lengkap

- [Debian Server Setup](./DEBIAN_SERVER_SETUP.md)
- [Debian Server README](./debian-server/README.md)
- [Project README](./replit.md)

## 🆘 Need Help?

1. Check logs:
   ```bash
   # Main server logs
   pm2 logs (jika menggunakan PM2)
   
   # Debian server logs
   tail -f builds/*.log
   ```

2. Check service status:
   ```bash
   curl http://localhost:5000/api/projects
   curl http://localhost:3001/health
   ```

3. Restart services:
   ```bash
   # Kill semua
   pkill -f "tsx"
   pkill -f "node"
   
   # Start ulang
   bash scripts/start-all.sh
   ```

## 🎯 Next Steps

Setelah setup berhasil:

1. **Create Your First Project**
   - Pilih template yang sesuai
   - Customize kode di editor
   - Build APK

2. **Explore Features**
   - Git commits untuk track changes
   - Build queue untuk multiple projects
   - Dashboard statistics

3. **Production Deployment**
   - Setup di VPS/Cloud server
   - Install Android SDK untuk real builds
   - Configure reverse proxy
   - Enable monitoring

---

**Selamat menggunakan Android Studio Web! 🎉**
