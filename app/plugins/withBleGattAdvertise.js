/**
 * Expo config plugin for BleGattAdvertise native module
 *
 * Adds the native iOS module for standard GATT BLE advertising
 * (which is detectable by other iOS devices via BLE scanning,
 * unlike iBeacon format which requires CoreLocation ranging)
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Swift source code for BleGattAdvertise
const SWIFT_SOURCE = `/**
 * BleGattAdvertise - Native iOS module for standard GATT BLE advertising
 *
 * This module advertises using standard CBPeripheralManager with service UUIDs,
 * which is detectable by other iOS devices via BLE scanning.
 * (Unlike iBeacon advertising which requires CoreLocation ranging)
 */

import Foundation
import CoreBluetooth

@objc(BleGattAdvertise)
class BleGattAdvertise: NSObject, CBPeripheralManagerDelegate {

  private var peripheralManager: CBPeripheralManager?
  private var isAdvertising = false
  private var serviceUUID: CBUUID?
  private var localName: String?

  // Pending resolve/reject for async operations
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  override init() {
    super.init()
  }

  /**
   * Start advertising with a service UUID and optional local name
   * The service UUID should encode the beacon token for discovery
   */
  @objc func startAdvertising(_ serviceUuidString: String,
                               localName: String,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {

    print("[BleGattAdvertise] Starting advertising with UUID: \\(serviceUuidString), name: \\(localName)")

    // Parse UUID
    guard let uuid = UUID(uuidString: serviceUuidString) else {
      reject("INVALID_UUID", "Invalid service UUID format", nil)
      return
    }

    self.serviceUUID = CBUUID(nsuuid: uuid)
    self.localName = localName
    self.pendingResolve = resolve
    self.pendingReject = reject

    // Initialize peripheral manager if needed
    if peripheralManager == nil {
      peripheralManager = CBPeripheralManager(delegate: self, queue: DispatchQueue.main)
    } else if peripheralManager?.state == .poweredOn {
      // Already powered on, start advertising now
      doStartAdvertising()
    }
    // Otherwise, wait for peripheralManagerDidUpdateState callback
  }

  /**
   * Stop advertising
   */
  @objc func stopAdvertising(_ resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {

    print("[BleGattAdvertise] Stopping advertising")

    if let manager = peripheralManager, isAdvertising {
      manager.stopAdvertising()
      manager.removeAllServices()
    }

    isAdvertising = false
    serviceUUID = nil
    localName = nil

    resolve(true)
  }

  /**
   * Check if currently advertising
   */
  @objc func isAdvertisingActive(_ resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) {
    resolve(isAdvertising)
  }

  // MARK: - CBPeripheralManagerDelegate

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    print("[BleGattAdvertise] Peripheral manager state: \\(peripheral.state.rawValue)")

    switch peripheral.state {
    case .poweredOn:
      // If we have a pending advertising request, start now
      if let _ = pendingResolve, let _ = serviceUUID {
        doStartAdvertising()
      }

    case .poweredOff:
      if let reject = pendingReject {
        reject("BLE_POWERED_OFF", "Bluetooth is powered off", nil)
        pendingResolve = nil
        pendingReject = nil
      }

    case .unauthorized:
      if let reject = pendingReject {
        reject("BLE_UNAUTHORIZED", "Bluetooth permission not granted", nil)
        pendingResolve = nil
        pendingReject = nil
      }

    case .unsupported:
      if let reject = pendingReject {
        reject("BLE_UNSUPPORTED", "Bluetooth LE is not supported", nil)
        pendingResolve = nil
        pendingReject = nil
      }

    default:
      break
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      print("[BleGattAdvertise] Failed to start advertising: \\(error.localizedDescription)")
      if let reject = pendingReject {
        reject("ADVERTISING_FAILED", error.localizedDescription, error)
        pendingResolve = nil
        pendingReject = nil
      }
      return
    }

    print("[BleGattAdvertise] Advertising started successfully")
    isAdvertising = true

    if let resolve = pendingResolve {
      resolve(true)
      pendingResolve = nil
      pendingReject = nil
    }
  }

  // MARK: - Private methods

  private func doStartAdvertising() {
    guard let manager = peripheralManager,
          let uuid = serviceUUID else {
      return
    }

    // Stop any existing advertising
    if isAdvertising {
      manager.stopAdvertising()
      manager.removeAllServices()
    }

    // Create a service with our UUID
    let service = CBMutableService(type: uuid, primary: true)
    manager.add(service)

    // Build advertisement data
    var advertisementData: [String: Any] = [
      CBAdvertisementDataServiceUUIDsKey: [uuid]
    ]

    // Add local name if provided (truncated to fit BLE packet)
    if let name = localName, !name.isEmpty {
      // BLE local name is limited, truncate if needed
      let maxNameLength = 20
      let truncatedName = String(name.prefix(maxNameLength))
      advertisementData[CBAdvertisementDataLocalNameKey] = truncatedName
    }

    print("[BleGattAdvertise] Starting with data: \\(advertisementData)")

    // Start advertising
    manager.startAdvertising(advertisementData)
  }

  // MARK: - React Native module requirements

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
`;

// Objective-C bridge source code
const OBJC_SOURCE = `/**
 * BleGattAdvertise - Objective-C bridge for React Native
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BleGattAdvertise, NSObject)

RCT_EXTERN_METHOD(startAdvertising:(NSString *)serviceUuidString
                  localName:(NSString *)localName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopAdvertising:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isAdvertisingActive:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
`;

/**
 * Adds BleGattAdvertise native module files to the iOS project
 */
const withBleGattAdvertise = (config) => {
  // First, write the source files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const iosDir = path.join(projectRoot, 'ios', projectName);

      // Ensure directory exists
      if (!fs.existsSync(iosDir)) {
        fs.mkdirSync(iosDir, { recursive: true });
      }

      // Write Swift file
      const swiftPath = path.join(iosDir, 'BleGattAdvertise.swift');
      fs.writeFileSync(swiftPath, SWIFT_SOURCE);
      console.log('[withBleGattAdvertise] Wrote Swift file:', swiftPath);

      // Write Objective-C bridge file
      const objcPath = path.join(iosDir, 'BleGattAdvertise.m');
      fs.writeFileSync(objcPath, OBJC_SOURCE);
      console.log('[withBleGattAdvertise] Wrote Objective-C file:', objcPath);

      // Update bridging header to include React Native
      const bridgingHeaderPath = path.join(iosDir, `${projectName}-Bridging-Header.h`);
      const bridgingHeaderContent = `//
// Use this file to import your target's public headers that you would like to expose to Swift.
//

#import <React/RCTBridgeModule.h>
`;
      fs.writeFileSync(bridgingHeaderPath, bridgingHeaderContent);
      console.log('[withBleGattAdvertise] Updated bridging header:', bridgingHeaderPath);

      return config;
    },
  ]);

  // Then add files to Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    // Get the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;

    // Find or create the app group
    let appGroupKey = null;
    const groups = xcodeProject.hash.project.objects.PBXGroup;
    for (const key in groups) {
      if (groups[key].name === projectName || groups[key].path === projectName) {
        appGroupKey = key;
        break;
      }
    }

    if (!appGroupKey) {
      console.warn('[withBleGattAdvertise] Could not find app group, files may not be added correctly');
      return config;
    }

    // Add Swift file
    const swiftFile = `${projectName}/BleGattAdvertise.swift`;
    const existingSwift = xcodeProject.getFirstProject().firstProject.mainGroup;

    try {
      xcodeProject.addSourceFile(
        swiftFile,
        { target: xcodeProject.getFirstTarget().uuid },
        appGroupKey
      );
      console.log('[withBleGattAdvertise] Added Swift file to Xcode project');
    } catch (e) {
      console.log('[withBleGattAdvertise] Swift file may already exist:', e.message);
    }

    // Add Objective-C file
    const objcFile = `${projectName}/BleGattAdvertise.m`;
    try {
      xcodeProject.addSourceFile(
        objcFile,
        { target: xcodeProject.getFirstTarget().uuid },
        appGroupKey
      );
      console.log('[withBleGattAdvertise] Added Objective-C file to Xcode project');
    } catch (e) {
      console.log('[withBleGattAdvertise] Objective-C file may already exist:', e.message);
    }

    return config;
  });

  return config;
};

module.exports = withBleGattAdvertise;
