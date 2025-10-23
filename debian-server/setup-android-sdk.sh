#!/bin/bash
set -e

echo "=========================================="
echo "Android SDK Setup for Production Builds"
echo "=========================================="

# Configuration
ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}
ANDROID_SDK_VERSION="11076708"  # Command line tools version

echo ""
echo "Installing required system packages..."
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk wget unzip

echo ""
echo "Setting up Android SDK at: $ANDROID_HOME"
sudo mkdir -p $ANDROID_HOME
sudo chown -R $USER:$USER $ANDROID_HOME

# Download Android command line tools
echo ""
echo "Downloading Android Command Line Tools..."
cd /tmp
wget -q https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_SDK_VERSION}_latest.zip
unzip -q commandlinetools-linux-${ANDROID_SDK_VERSION}_latest.zip
mkdir -p $ANDROID_HOME/cmdline-tools
mv cmdline-tools $ANDROID_HOME/cmdline-tools/latest
rm commandlinetools-linux-${ANDROID_SDK_VERSION}_latest.zip

# Set environment variables
export ANDROID_HOME=$ANDROID_HOME
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

echo ""
echo "Installing Android SDK components..."
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Install additional packages for specific frameworks
echo ""
echo "Installing additional SDK packages..."
sdkmanager "platforms;android-33" "platforms;android-32" "build-tools;33.0.0"

echo ""
echo "=========================================="
echo "Android SDK Installation Complete!"
echo "=========================================="
echo ""
echo "Add these to your environment variables:"
echo "export ANDROID_HOME=$ANDROID_HOME"
echo "export ANDROID_SDK_ROOT=$ANDROID_HOME"
echo "export JAVA_HOME=$JAVA_HOME"
echo "export PATH=\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH"
echo ""
echo "To make permanent, add to ~/.bashrc or ~/.profile"
