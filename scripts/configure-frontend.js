#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('================================');
  console.log('Frontend Configuration Setup');
  console.log('================================\n');

  // Read .env file to get default values
  let envContent = '';
  let defaultApiKey = '';
  let defaultPort = '3001';

  try {
    envContent = fs.readFileSync('.env', 'utf8');
    const apiKeyMatch = envContent.match(/DEBIAN_API_KEY=(.+)/);
    const portMatch = envContent.match(/DEBIAN_SERVER_PORT=(\d+)/);
    
    if (apiKeyMatch) defaultApiKey = apiKeyMatch[1];
    if (portMatch) defaultPort = portMatch[1];
  } catch (err) {
    console.log('⚠️  .env file not found. Please run setup script first:');
    console.log('   bash scripts/setup-debian-server.sh\n');
  }

  console.log('This script will create a configuration file for the frontend.');
  console.log('The frontend will automatically connect to your Debian build server.\n');

  const serverUrl = await question(`Debian Server URL [http://localhost:${defaultPort}]: `) 
    || `http://localhost:${defaultPort}`;
  
  const apiKey = await question(`API Key [${defaultApiKey}]: `) 
    || defaultApiKey;

  rl.close();

  // Create client-side config
  const config = {
    debianServer: {
      url: serverUrl,
      apiKey: apiKey,
      configured: true,
      configuredAt: new Date().toISOString()
    }
  };

  // Write to public directory so it can be accessed by the client
  const configPath = path.join(__dirname, '..', 'client', 'public', 'config.json');
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\n✅ Configuration saved successfully!');
    console.log(`📄 Config file: ${configPath}`);
    console.log('\nThe frontend will automatically connect to:');
    console.log(`   URL: ${serverUrl}`);
    console.log(`   Using API key: ${apiKey.substring(0, 10)}...`);
    console.log('\nYou can still change these settings in the app Settings page.');
  } catch (err) {
    console.error('\n❌ Error writing config file:', err.message);
    console.log('\nManual configuration:');
    console.log('1. Open the app in your browser');
    console.log('2. Go to Settings');
    console.log('3. Enter:');
    console.log(`   Server URL: ${serverUrl}`);
    console.log(`   API Key: ${apiKey}`);
  }

  console.log('\n================================');
}

main().catch(console.error);
