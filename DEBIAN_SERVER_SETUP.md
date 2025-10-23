# Setup Debian Build Server

## Cara Menjalankan Debian Build Server

Server Debian sudah siap digunakan. Berikut cara menjalankannya:

### 1. Jalankan Server Debian (Development)

```bash
NODE_ENV=development tsx debian-server/index.ts
```

Atau buat workflow baru di Replit dengan command di atas.

### 2. Konfigurasi Environment

Server akan berjalan di port 3001 secara default. Untuk mengubah konfigurasi, set environment variables:

```bash
export DEBIAN_SERVER_PORT=3001
export DEBIAN_SERVER_HOST=0.0.0.0  
export DEBIAN_API_KEY=your-secure-api-key
```

### 3. Konfigurasi Frontend

Setelah server Debian berjalan:

1. Buka aplikasi di browser
2. Pergi ke **Settings**
3. Masukkan konfigurasi server:
   - **Server URL**: `http://localhost:3001` (jika lokal) atau URL server Debian Anda
   - **API Key**: Sama dengan `DEBIAN_API_KEY` yang Anda set (default: `dev-key-change-in-production`)

### 4. Test Build

1. Buat project baru dari template
2. Klik tombol "Build APK"
3. Monitor progress di panel Build Status
4. Download APK setelah build selesai

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│                 │         │                  │
│   Frontend      │────────▶│  Main Server     │
│   (React)       │         │  (Port 5000)     │
│                 │         │                  │
└─────────────────┘         └──────────────────┘
                                     │
                                     │ HTTP API
                                     ▼
                            ┌──────────────────┐
                            │                  │
                            │  Debian Build    │
                            │  Server          │
                            │  (Port 3001)     │
                            │                  │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │                  │
                            │  Build Engine    │
                            │  - React Native  │
                            │  - Flutter       │
                            │  - Capacitor     │
                            │                  │
                            └──────────────────┘
```

## Fitur yang Sudah Diimplementasi

### Backend Integration
- ✅ Debian build service dengan komunikasi HTTP
- ✅ Build queue management dengan concurrent build limit
- ✅ WebSocket untuk real-time build updates
- ✅ Server configuration endpoints
- ✅ Health check endpoint
- ✅ Build status polling
- ✅ APK download handling

### Debian Server
- ✅ Build processing untuk React Native, Flutter, Capacitor
- ✅ Real-time build logs
- ✅ Build queue management
- ✅ APK generation dan storage
- ✅ API authentication dengan Bearer token
- ✅ Auto cleanup untuk build lama
- ✅ Build cancellation
- ✅ Progress tracking

## API Endpoints (Debian Server)

### Public
- `GET /health` - Health check

### Protected (Require API Key)
- `POST /api/builds` - Submit build
- `GET /api/builds/:buildId` - Get build status
- `GET /api/builds/:buildId/logs` - Get build logs
- `POST /api/builds/:buildId/cancel` - Cancel build
- `GET /api/builds/:buildId/download` - Download APK
- `GET /api/builds` - List all builds

## Production Deployment

### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start Debian server
pm2 start tsx --name "debian-server" -- debian-server/index.ts

# Monitor
pm2 monit
pm2 logs debian-server
```

### Option 2: Docker

```dockerfile
FROM node:20

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

ENV DEBIAN_SERVER_PORT=3001
ENV DEBIAN_API_KEY=change-in-production

EXPOSE 3001

CMD ["node", "dist/debian/index.js"]
```

### Option 3: Systemd Service

```ini
[Unit]
Description=Debian Build Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/project
Environment="DEBIAN_SERVER_PORT=3001"
Environment="DEBIAN_API_KEY=your-key"
ExecStart=/usr/bin/tsx debian-server/index.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Security Checklist

- [ ] Ganti API key default
- [ ] Gunakan HTTPS (reverse proxy dengan nginx/caddy)
- [ ] Setup firewall rules
- [ ] Enable rate limiting
- [ ] Secure file uploads
- [ ] Monitor disk usage
- [ ] Setup log rotation

## Troubleshooting

### Server tidak bisa start
- Check port 3001 sudah digunakan atau belum
- Verify permissions untuk create directories
- Check logs untuk error details

### Build gagal
- Verify disk space tersedia
- Check build logs untuk error details
- Ensure all required SDK installed (untuk production)

### Frontend tidak bisa connect
- Verify server URL correct
- Check API key match
- Verify firewall allow connection
- Check CORS settings jika berbeda domain

## Production Setup

✅ **PRODUCTION READY!** 

Sistem build sudah diupdate untuk kompilasi APK nyata. Lihat **PRODUCTION_SETUP.md** untuk panduan lengkap setup production.

### Quick Production Setup

1. Install Android SDK:
   ```bash
   cd debian-server
   ./setup-android-sdk.sh
   ```

2. Install Flutter (optional):
   ```bash
   ./setup-flutter.sh
   ```

3. Install React Native CLI (optional):
   ```bash
   ./setup-react-native.sh
   ```

4. Start Debian server dengan environment yang benar
5. Configure server URL di Settings page

## Next Steps (Optimization)

1. **Caching**: Add caching untuk npm/gradle dependencies
2. **Scaling**: Setup multiple build servers dengan load balancer
3. **Monitoring**: Add monitoring dengan Prometheus/Grafana
4. **Logs**: Setup centralized logging
5. **CI/CD**: Integrate dengan CI/CD pipeline
