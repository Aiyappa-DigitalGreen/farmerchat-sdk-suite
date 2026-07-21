/**
 * Metro config for the example app.
 *
 * The SDK is consumed via a `file:` (symlinked) dependency, and the package
 * directory carries its own node_modules (devDependencies incl. react /
 * react-native). Without this config Metro would resolve those duplicate
 * copies through the symlink and crash with "Invalid hook call" / duplicate
 * React errors. We watch the package folder, force all module resolution to
 * the example's node_modules, and block the package's own node_modules.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packageRoot = path.resolve(projectRoot, '..', 'packages', 'farmerchat-react-native');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [packageRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
config.resolver.blockList = [
  new RegExp(`${packageRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/.*`),
];

module.exports = config;
