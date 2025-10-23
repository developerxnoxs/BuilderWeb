# Production Setup Guide - Real APK Compilation

Panduan lengkap untuk setup Debian Build Server dengan kompilasi APK nyata menggunakan Android SDK, React Native, Flutter, dan Capacitor.

## 📋 Prerequisites

### Sistem Requirements
- **OS**: Debian/Ubuntu Linux (Ubuntu 20.04+ atau Debian 11+ recommended)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: Minimum 50GB free space
- **CPU**: Multi-core processor (4+ cores recommended)
- **Network**: Stable internet connection untuk download SDK

### Software Requirements
- Node.js 18+ (sudah terinstall di project ini)
- Java Development Kit (JDK) 17
- Git

## 🚀 Step 1: Install Android SDK

Android SDK diperlukan untuk semua framework (React Native, Flutter, Capacitor).

```bash
cd debian-server
chmod +x setup-android-sdk.sh
./setup-android-sdk.sh
```

Script ini akan:
- Install OpenJDK 17
- Download Android Command Line Tools
- Setup ANDROID_HOME di `/opt/android-sdk`
- Install Platform Tools, Build Tools, dan Android Platform SDK
- Accept semua Android licenses

### Manual Environment Setup

Tambahkan ke `~/.bashrc` atau `~/.profile`:

```bash
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
```

Reload environment:
```bash
source ~/.bashrc
```

Verify installation:
```bash
echo $ANDROID_HOME
sdkmanager --version
adb --version
```

## 🚀 Step 2: Install Flutter SDK (Untuk Flutter Projects)

Jika Anda akan build Flutter projects:

```bash
chmod +x setup-flutter.sh
./setup-flutter.sh
```

Script ini akan:
- Download Flutter SDK stable terbaru
- Install Flutter di `/opt/flutter`
- Run `flutter doctor` untuk check setup
- Accept Android licenses untuk Flutter

### Verify Flutter Installation

```bash
flutter --version
flutter doctor
```

Flutter doctor seharusnya menunjukkan:
- ✓ Flutter (Channel stable)
- ✓ Android toolchain
- ✓ Android Studio (optional)

## 🚀 Step 3: Install React Native CLI (Untuk React Native Projects)

Jika Anda akan build React Native projects:

```bash
chmod +x setup-react-native.sh
./setup-react-native.sh
```

Script ini akan:
- Install React Native CLI globally
- Install Watchman (file watcher untuk React Native)

### Verify React Native Setup

```bash
react-native --version
watchman version
```

## 🚀 Step 4: Setup APK Signing

APK signing sudah otomatis menggunakan keystore generator. Setiap project mendapat keystore uniknya sendiri.

### Keystore Location
Keystores disimpan di: `keystores/{projectId}.keystore`

### Keystore Configuration
File config: `keystores/{projectId}.json`

Keystore di-generate otomatis saat build pertama kali. Anda bisa customize dengan mengedit `debian-server/keystore-generator.ts`.

### Manual Keystore Generation (Optional)

```bash
keytool -genkeypair \
  -v \
  -keystore my-release-key.keystore \
  -alias my-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass yourPassword \
  -keypass yourPassword \
  -dname "CN=YourName, OU=Dev, O=Company, L=City, ST=State, C=ID"
```

### APK Signing Process

System menggunakan **apksigner** (Android SDK Build Tools 34.0.0+) untuk signing APK:

1. **zipalign**: Optimize APK alignment untuk faster loading
2. **apksigner**: Sign APK dengan keystore
3. **apksigner verify**: Verify signature validity

Order ini penting! Zipalign harus dilakukan **sebelum** signing, karena zipalign setelah signing akan invalidate signature.

## 🚀 Step 5: Configure dan Start Debian Build Server

### Set Environment Variables

Buat file `.env` di root directory:

```bash
# Debian Build Server
DEBIAN_SERVER_PORT=3001
DEBIAN_SERVER_HOST=0.0.0.0
DEBIAN_API_KEY=your-secure-production-api-key

# Android SDK
ANDROID_HOME=/opt/android-sdk
ANDROID_SDK_ROOT=/opt/android-sdk
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Flutter (optional)
FLUTTER_HOME=/opt/flutter

# Build Directories
BUILDS_DIR=/opt/builds
APKS_DIR=/opt/apks
```

### Create Build Directories

```bash
sudo mkdir -p /opt/builds /opt/apks
sudo chown -R $USER:$USER /opt/builds /opt/apks
```

### Start Server

Development:
```bash
cd debian-server
npm install
NODE_ENV=development tsx index.ts
```

Production (dengan PM2):
```bash
npm install -g pm2
pm2 start tsx --name "debian-build-server" -- debian-server/index.ts
pm2 save
pm2 startup
```

### Verify Server Running

```bash
curl http://localhost:3001/health
```

Response: `{"status":"ok"}`

## 🚀 Step 6: Configure Main Application

### Update Server Configuration

1. Buka aplikasi di browser
2. Pergi ke **Settings** page
3. Masukkan konfigurasi:
   - **Server URL**: `http://localhost:3001` (atau IP server Debian)
   - **API Key**: Sesuai dengan `DEBIAN_API_KEY` yang Anda set

### Test Health Check

Di Settings page, klik "Test Connection". Seharusnya menampilkan "✓ Server is healthy".

## 🧪 Testing Build System

### Test React Native Build

1. Create new project dari React Native template
2. Klik "Build APK"
3. Monitor logs - seharusnya menjalankan:
   - `npm install`
   - `react-native bundle`
   - `gradlew assembleRelease`
   - APK signing

### Test Flutter Build

1. Create new project dari Flutter template
2. Klik "Build APK"
3. Monitor logs - seharusnya menjalankan:
   - `flutter pub get`
   - `flutter build apk --release`
   - APK signing

### Test Capacitor Build

1. Create new project dari Capacitor template
2. Klik "Build APK"
3. Monitor logs - seharusnya menjalankan:
   - `npm install`
   - `npm run build`
   - `npx cap sync android`
   - `gradlew assembleRelease`
   - APK signing

## 📱 Install APK ke Device

Setelah build sukses, download APK dan install:

### Via ADB
```bash
adb install path/to/your-app.apk
```

### Via File Transfer
1. Transfer APK ke Android device
2. Enable "Install from Unknown Sources" di Settings
3. Tap APK file untuk install

## 🔧 Troubleshooting

### Build Gagal: "ANDROID_HOME not found"

Pastikan environment variables sudah di-set:
```bash
echo $ANDROID_HOME
```

Jika kosong, tambahkan ke `~/.bashrc` dan `source ~/.bashrc`.

### Build Gagal: "Gradle build failed"

Check Java version:
```bash
java -version
```

Harus Java 17. Jika bukan:
```bash
sudo update-alternatives --config java
```

### Build Timeout

Increase timeout di `debian-server/build-processor.ts`:
```typescript
await runCommand(buildId, androidDir, "./gradlew assembleRelease", 900000); // 15 minutes
```

### Memory Issues

Increase Gradle heap size. Buat file `gradle.properties`:
```
org.gradle.jvmargs=-Xmx4096m
org.gradle.daemon=true
```

### Flutter: "Android licenses not accepted"

```bash
flutter doctor --android-licenses
```

Accept semua licenses dengan ketik `y`.

### React Native: "Watchman not found"

```bash
sudo apt-get install watchman
```

Atau compile dari source (lihat setup-react-native.sh).

## 🔒 Security Best Practices

### Production Checklist

- [ ] Change default API key (`DEBIAN_API_KEY`)
- [ ] Use HTTPS dengan reverse proxy (nginx/caddy)
- [ ] Setup firewall rules (allow only port 3001 dari main server)
- [ ] Restrict file upload size (sudah 10MB di config)
- [ ] Enable rate limiting
- [ ] Secure keystore directory permissions
- [ ] Regular cleanup old builds (sudah auto 24 jam)
- [ ] Monitor disk usage
- [ ] Setup log rotation

### Recommended Firewall Rules

```bash
# UFW
sudo ufw allow from MAIN_SERVER_IP to any port 3001
sudo ufw deny 3001
```

### Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 443 ssl;
    server_name build.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
    }
}
```

## 📊 Monitoring dan Maintenance

### Monitor Builds

```bash
pm2 logs debian-build-server
```

### Check Disk Space

```bash
df -h /opt/builds /opt/apks
```

### Manual Cleanup

```bash
# Cleanup builds older than 7 days
find /opt/builds -type d -mtime +7 -exec rm -rf {} +
find /opt/apks -type f -mtime +7 -delete
```

### Performance Tuning

Untuk production dengan high load:
- Setup multiple build servers dengan load balancer
- Use caching untuk npm/gradle dependencies
- SSD storage untuk faster builds
- Increase concurrent build limit di build-queue.ts

## 🎯 Build Time Estimates

**React Native**: 3-10 menit (tergantung dependencies)
**Flutter**: 5-15 menit (first build lebih lama)
**Capacitor**: 4-12 menit

Build pertama akan lebih lama karena download dependencies. Build selanjutnya lebih cepat dengan cache.

## 📚 Additional Resources

- [Android SDK Documentation](https://developer.android.com/studio/command-line)
- [React Native Documentation](https://reactnative.dev/)
- [Flutter Documentation](https://flutter.dev/docs)
- [Capacitor Documentation](https://capacitorjs.com/)
- [Gradle Build Tool](https://gradle.org/)

## 🆘 Support

Jika menemui masalah:
1. Check logs di PM2: `pm2 logs debian-build-server`
2. Check build logs di frontend Build Status panel
3. Verify environment variables: `printenv | grep ANDROID`
4. Run `flutter doctor` atau check Android SDK installation

---

**Status**: ✅ Production Ready dengan Real APK Compilation

**Last Updated**: October 2025
