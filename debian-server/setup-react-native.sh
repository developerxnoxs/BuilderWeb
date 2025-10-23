#!/bin/bash
set -e

echo "=========================================="
echo "React Native Setup for Production Builds"
echo "=========================================="

echo ""
echo "Installing React Native CLI globally..."
npm install -g react-native-cli

echo ""
echo "Installing Watchman (recommended for React Native)..."
if command -v watchman &> /dev/null; then
    echo "Watchman already installed"
else
    echo "Installing Watchman dependencies..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip autoconf automake libtool
    
    cd /tmp
    git clone https://github.com/facebook/watchman.git
    cd watchman
    git checkout v2024.01.08.00
    ./autogen.sh
    ./configure
    make
    sudo make install
    cd ..
    rm -rf watchman
fi

echo ""
echo "=========================================="
echo "React Native Setup Complete!"
echo "=========================================="
echo ""
echo "You can now build React Native projects."
echo "Make sure Android SDK is also installed (run setup-android-sdk.sh)"
