import { Capacitor } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryType,
  BiometryError,
  AndroidBiometryStrength,
} from "@aparajita/capacitor-biometric-auth";
import { syncNativePersistenceFromLocalStorage } from "@/lib/nativePersistence";

const ENABLED_KEY = "bb_biometric_enabled";
const DISABLED_KEY = "bb_biometric_disabled";
export const BIOMETRIC_PREFERENCE_CHANGED_EVENT = "bb_biometric_preference_changed";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable && info.biometryType !== BiometryType.none;
  } catch {
    return false;
  }
}

export async function getBiometryLabel(): Promise<string> {
  try {
    const info = await BiometricAuth.checkBiometry();
    switch (info.biometryType) {
      case BiometryType.faceId:
        return "Face ID";
      case BiometryType.touchId:
        return "Touch ID";
      case BiometryType.fingerprintAuthentication:
        return "Fingerprint";
      case BiometryType.faceAuthentication:
        return "Face Unlock";
      case BiometryType.irisAuthentication:
        return "Iris";
      default:
        return Capacitor.getPlatform() === "ios" ? "Face ID" : "Biometrics";
    }
  } catch {
    return Capacitor.getPlatform() === "ios" ? "Face ID" : "Biometrics";
  }
}

export function isBiometricEnabled(): boolean {
  return isNative();
}

export function isBiometricSetupPending(): boolean {
  return false;
}

export function shouldRequireBiometricUnlock(): boolean {
  return isNative();
}

export function setBiometricEnabled(_on = true) {
  localStorage.setItem(ENABLED_KEY, "1");
  localStorage.removeItem(DISABLED_KEY);
  void syncNativePersistenceFromLocalStorage();
  window.dispatchEvent(new CustomEvent(BIOMETRIC_PREFERENCE_CHANGED_EVENT));
}

export async function authenticateWithBiometrics(
  reason = "Unlock bye bye diabetes"
): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
      androidTitle: "Unlock",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return true;
  } catch (err) {
    const e = err as BiometryError;
    console.warn("Biometric auth failed:", e?.message ?? err);
    return false;
  }
}
