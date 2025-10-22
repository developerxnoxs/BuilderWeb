# Debian Build Server

Server untuk kompilasi aplikasi Android (React Native, Flutter, Capacitor) yang berkomunikasi dengan frontend.

## Fitur

- ✅ Kompilasi React Native, Flutter, dan Capacitor
- ✅ Build queue dengan manajemen antrian
- ✅ Real-time build logs
- ✅ APK download
- ✅ Autentikasi dengan API key
- ✅ Auto cleanup build lama
- ✅ Health check endpoint

## Setup

### 1. Environment Variables

Buat file `.env` di root project:

```env
# Debian Server Configuration
DEBIAN_SERVER_PORT=3001
DEBIAN_SERVER_HOST=0.0.0.0
DEBIAN_API_KEY=your-secure-api-key-here
BUILDS_DIR=./builds
APKS_DIR=./apks
```

### 2. Install Dependencies

Dependencies sudah terinstall di root project.

### 3. Run Server

```bash
# Development
npm run debian:dev

# Production
npm run debian:start
```

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "debian-build-server"
}
```

### Submit Build
```
POST /api/builds
Authorization: Bearer YOUR_API_KEY
```

Request:
```json
{
  "projectId": "uuid",
  "projectName": "My App",
  "framework": "react-native",
  "files": [
    {
      "path": "App.js",
      "content": "..."
    }
  ],
  "buildConfig": {}
}
```

Response:
```json
{
  "buildId": "uuid"
}
```

### Get Build Status
```
GET /api/builds/:buildId
Authorization: Bearer YOUR_API_KEY
```

Response:
```json
{
  "buildId": "uuid",
  "status": "building",
  "progress": 50,
  "logs": [...],
  "apkUrl": "/api/builds/:buildId/download",
  "errorMessage": null
}
```

### Get Build Logs
```
GET /api/builds/:buildId/logs
Authorization: Bearer YOUR_API_KEY
```

### Cancel Build
```
POST /api/builds/:buildId/cancel
Authorization: Bearer YOUR_API_KEY
```

### Download APK
```
GET /api/builds/:buildId/download
Authorization: Bearer YOUR_API_KEY
```

### List All Builds
```
GET /api/builds
Authorization: Bearer YOUR_API_KEY
```

## Konfigurasi Frontend

Di frontend, konfigurasikan server di Settings:

1. **Server URL**: `http://localhost:3001` (development) atau `https://your-debian-server.com` (production)
2. **API Key**: Sama dengan `DEBIAN_API_KEY` di environment variables

## Production Setup

### Menggunakan PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start npm --name "debian-build-server" -- run debian:start

# Save configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

### Menggunakan Docker

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV DEBIAN_SERVER_PORT=3001
ENV DEBIAN_API_KEY=change-me-in-production

CMD ["npm", "run", "debian:start"]
```

### Menggunakan systemd

Buat file `/etc/systemd/system/debian-build-server.service`:

```ini
[Unit]
Description=Debian Build Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/project
Environment="NODE_ENV=production"
Environment="DEBIAN_SERVER_PORT=3001"
Environment="DEBIAN_API_KEY=your-api-key"
ExecStart=/usr/bin/npm run debian:start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable dan start:
```bash
sudo systemctl enable debian-build-server
sudo systemctl start debian-build-server
```

## Security

1. **Ganti API Key**: Jangan gunakan default API key di production
2. **HTTPS**: Gunakan reverse proxy (nginx/caddy) dengan SSL
3. **Firewall**: Batasi akses ke port build server
4. **Rate Limiting**: Tambahkan rate limiting untuk mencegah abuse

## Monitoring

Monitor build server:

```bash
# Check logs
pm2 logs debian-build-server

# Monitor resources
pm2 monit
```

## Troubleshooting

### Build Gagal

1. Check logs di `/tmp/logs/` atau PM2 logs
2. Pastikan dependencies terinstall (React Native SDK, Flutter SDK, etc.)
3. Check disk space untuk builds dan APKs

### Connection Error

1. Check firewall rules
2. Verify API key
3. Check server URL configuration

### Performance Issues

1. Increase concurrent build limit di `build-queue.ts`
2. Add more server resources (CPU, RAM)
3. Enable build caching
