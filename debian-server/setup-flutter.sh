#!/bin/bash
set -e

echo "=========================================="
echo "Flutter SDK Setup for Production Builds"
echo "=========================================="

# Configuration
FLUTTER_VERSION="3.24.5"
FLUTTER_HOME=${FLUTTER_HOME:-/opt/flutter}

echo ""
echo "Downloading Flutter SDK version $FLUTTER_VERSION..."
cd /tmp
wget -q https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz
tar xf flutter_linux_${FLUTTER_VERSION}-stable.tar.xz
sudo mv flutter $FLUTTER_HOME
rm flutter_linux_${FLUTTER_VERSION}-stable.tar.xz

# Add to PATH
export PATH=$FLUTTER_HOME/bin:$PATH

echo ""
echo "Running Flutter doctor..."
flutter doctor

echo ""
echo "Accepting Android licenses..."
flutter doctor --android-licenses

echo ""
echo "=========================================="
echo "Flutter SDK Installation Complete!"
echo "=========================================="
echo ""
echo "Add this to your environment variables:"
echo "export FLUTTER_HOME=$FLUTTER_HOME"
echo "export PATH=\$FLUTTER_HOME/bin:\$PATH"
echo ""
echo "To make permanent, add to ~/.bashrc or ~/.profile"
