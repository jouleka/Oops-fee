const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Swift file for WidgetKit native module
const WIDGET_KIT_SWIFT = `import Foundation
import WidgetKit

@objc(WidgetKitModule)
class WidgetKitModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func reloadAllTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
      print("[WidgetKitModule] Reloaded all widget timelines")
    }
  }
  
  @objc
  func reloadTimelines(_ kind: String) {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: kind)
      print("[WidgetKitModule] Reloaded timelines for kind: \\(kind)")
    }
  }
}
`;

// Objective-C bridge file
const WIDGET_KIT_BRIDGE = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetKitModule, NSObject)

RCT_EXTERN_METHOD(reloadAllTimelines)
RCT_EXTERN_METHOD(reloadTimelines:(NSString *)kind)

@end
`;

const withWidgetKitModule = (config) => {
  // First, add the native files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios');
      
      // Find the app name from the ios folder
      const items = fs.readdirSync(iosPath);
      const appFolder = items.find(
        (item) =>
          !item.includes('.') &&
          !item.includes('Pods') &&
          !item.includes('build') &&
          fs.statSync(path.join(iosPath, item)).isDirectory()
      );
      
      if (!appFolder) {
        console.warn('[withWidgetKitModule] Could not find app folder in ios directory');
        return config;
      }
      
      // Write files directly to the app folder (not a subfolder)
      const appDir = path.join(iosPath, appFolder);
      
      // Write Swift file
      fs.writeFileSync(
        path.join(appDir, 'WidgetKitModule.swift'),
        WIDGET_KIT_SWIFT
      );
      
      // Write Objective-C bridge file
      fs.writeFileSync(
        path.join(appDir, 'WidgetKitModule.m'),
        WIDGET_KIT_BRIDGE
      );
      
      console.log('[withWidgetKitModule] Added WidgetKitModule native files to', appDir);
      
      return config;
    },
  ]);
  
  // Then, add the files to the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    
    // Find the main app group
    const appGroupKey = Object.keys(xcodeProject.hash.project.objects.PBXGroup).find(
      (key) => {
        const group = xcodeProject.hash.project.objects.PBXGroup[key];
        return group && (group.name === projectName || group.path === projectName);
      }
    );
    
    if (!appGroupKey) {
      console.warn('[withWidgetKitModule] Could not find app group in Xcode project');
      return config;
    }
    
    // Add files to the project - files are in the app folder
    const filesToAdd = [
      { name: 'WidgetKitModule.swift', relativePath: `${projectName}/WidgetKitModule.swift` },
      { name: 'WidgetKitModule.m', relativePath: `${projectName}/WidgetKitModule.m` },
    ];
    
    for (const file of filesToAdd) {
      // Check if file already exists in project by checking file references
      const existingFile = Object.keys(xcodeProject.hash.project.objects.PBXFileReference || {}).find(
        (key) => {
          const ref = xcodeProject.hash.project.objects.PBXFileReference[key];
          return ref && ref.path && ref.path === file.name;
        }
      );
      
      if (!existingFile) {
        xcodeProject.addSourceFile(file.relativePath, null, appGroupKey);
        console.log('[withWidgetKitModule] Added', file.name, 'to Xcode project');
      } else {
        console.log('[withWidgetKitModule]', file.name, 'already in project');
      }
    }
    
    return config;
  });
  
  return config;
};

module.exports = withWidgetKitModule;
