import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export interface KeystoreConfig {
  keystorePath: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
  validity: number;
  distinguishedName: {
    commonName: string;
    organizationalUnit: string;
    organization: string;
    locality: string;
    state: string;
    country: string;
  };
}

const DEFAULT_KEYSTORE_DIR = path.join(process.cwd(), "keystores");

export async function generateKeystore(
  projectId: string,
  config?: Partial<KeystoreConfig>
): Promise<KeystoreConfig> {
  await fs.mkdir(DEFAULT_KEYSTORE_DIR, { recursive: true });

  const keystoreConfig: KeystoreConfig = {
    keystorePath: path.join(DEFAULT_KEYSTORE_DIR, `${projectId}.keystore`),
    keystorePassword: config?.keystorePassword || generateRandomPassword(),
    keyAlias: config?.keyAlias || `${projectId}-key`,
    keyPassword: config?.keyPassword || generateRandomPassword(),
    validity: config?.validity || 10000,
    distinguishedName: {
      commonName: config?.distinguishedName?.commonName || "Android Studio IDE",
      organizationalUnit: config?.distinguishedName?.organizationalUnit || "Development",
      organization: config?.distinguishedName?.organization || "Android Studio",
      locality: config?.distinguishedName?.locality || "Jakarta",
      state: config?.distinguishedName?.state || "DKI Jakarta",
      country: config?.distinguishedName?.country || "ID",
    },
  };

  const dname = `CN=${keystoreConfig.distinguishedName.commonName}, OU=${keystoreConfig.distinguishedName.organizationalUnit}, O=${keystoreConfig.distinguishedName.organization}, L=${keystoreConfig.distinguishedName.locality}, ST=${keystoreConfig.distinguishedName.state}, C=${keystoreConfig.distinguishedName.country}`;

  const command = `keytool -genkeypair -v -keystore "${keystoreConfig.keystorePath}" -alias "${keystoreConfig.keyAlias}" -keyalg RSA -keysize 2048 -validity ${keystoreConfig.validity} -storepass "${keystoreConfig.keystorePassword}" -keypass "${keystoreConfig.keyPassword}" -dname "${dname}"`;

  try {
    await execAsync(command);
    console.log(`Keystore generated successfully: ${keystoreConfig.keystorePath}`);
    return keystoreConfig;
  } catch (error) {
    throw new Error(`Failed to generate keystore: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function signAPK(
  unsignedApkPath: string,
  keystoreConfig: KeystoreConfig
): Promise<string> {
  const alignedApkPath = unsignedApkPath.replace(".apk", "-aligned.apk");
  const signedApkPath = unsignedApkPath.replace(".apk", "-signed.apk");

  try {
    const zipalignCommand = `zipalign -v -p 4 "${unsignedApkPath}" "${alignedApkPath}"`;
    await execAsync(zipalignCommand, {
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || "/opt/android-sdk",
        PATH: `${process.env.ANDROID_HOME || "/opt/android-sdk"}/build-tools/34.0.0:${process.env.PATH}`,
      },
    });

    const apksignerCommand = `apksigner sign --ks "${keystoreConfig.keystorePath}" --ks-pass pass:"${keystoreConfig.keystorePassword}" --key-pass pass:"${keystoreConfig.keyPassword}" --ks-key-alias "${keystoreConfig.keyAlias}" --out "${signedApkPath}" "${alignedApkPath}"`;
    
    await execAsync(apksignerCommand, {
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || "/opt/android-sdk",
        PATH: `${process.env.ANDROID_HOME || "/opt/android-sdk"}/build-tools/34.0.0:${process.env.PATH}`,
      },
    });

    await execAsync(`apksigner verify "${signedApkPath}"`, {
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || "/opt/android-sdk",
        PATH: `${process.env.ANDROID_HOME || "/opt/android-sdk"}/build-tools/34.0.0:${process.env.PATH}`,
      },
    });

    await fs.unlink(unsignedApkPath).catch(() => {});
    await fs.unlink(alignedApkPath).catch(() => {});

    console.log(`APK signed and verified successfully: ${signedApkPath}`);
    return signedApkPath;
  } catch (error) {
    await fs.unlink(alignedApkPath).catch(() => {});
    throw new Error(`Failed to sign APK: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function generateRandomPassword(length: number = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function getOrCreateKeystore(projectId: string): Promise<KeystoreConfig> {
  const keystorePath = path.join(DEFAULT_KEYSTORE_DIR, `${projectId}.keystore`);
  const configPath = path.join(DEFAULT_KEYSTORE_DIR, `${projectId}.json`);

  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData) as KeystoreConfig;
    
    await fs.access(config.keystorePath);
    
    return config;
  } catch {
    const newConfig = await generateKeystore(projectId);
    
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
    
    return newConfig;
  }
}
