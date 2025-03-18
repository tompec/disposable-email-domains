#!/usr/bin/env node

/**
 * This script automates the release process for the disposable-email-domains package.
 * It handles versioning, processing domains, testing, and publishing to both npm and GitHub.
 *
 * Usage:
 *   node scripts/release.js [patch|minor|major]
 *
 * Example:
 *   node scripts/release.js patch  # Increments the patch version (1.0.0 -> 1.0.1)
 *   node scripts/release.js minor  # Increments the minor version (1.0.0 -> 1.1.0)
 *   node scripts/release.js major  # Increments the major version (1.0.0 -> 2.0.0)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get the version type from command line arguments
const versionType = process.argv[2] || 'patch';

// Validate version type
if (!['patch', 'minor', 'major'].includes(versionType)) {
    console.error('Error: Version type must be one of: patch, minor, major');
    process.exit(1);
}

/**
 * Executes a shell command and returns the output
 * @param {string} command - The command to execute
 * @param {boolean} silent - Whether to suppress console output
 * @returns {string} - The command output
 */
function exec(command, silent = false) {
    try {
        if (!silent) {
            console.log(`Executing: ${command}`);
        }
        return execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * Gets the current version from package.json
 * @returns {string} - The current version
 */
function getCurrentVersion() {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
}

/**
 * Checks if the working directory is clean
 * @returns {boolean} - Whether the working directory is clean
 */
function isWorkingDirectoryClean() {
    try {
        const status = exec('git status --porcelain', true);
        return status.trim() === '';
    } catch (error) {
        console.error('Error checking git status:', error.message);
        return false;
    }
}

/**
 * Checks if the user is logged in to npm
 * @returns {boolean} - Whether the user is logged in
 */
function isNpmLoggedIn() {
    try {
        const whoami = exec('npm whoami', true);
        return whoami.trim() !== '';
    } catch (error) {
        return false;
    }
}

/**
 * Processes domains using the domain-manager.js script
 */
function processDomains() {
    console.log('\n🔄 Processing domains...');
    exec('node scripts/domain-manager.js');
}

/**
 * Main release process
 */
async function release() {
    try {
        // Check if git working directory is clean
        if (!isWorkingDirectoryClean()) {
            console.error('Error: Working directory is not clean. Please commit or stash your changes first.');
            process.exit(1);
        }

        // Check if user is logged in to npm
        if (!isNpmLoggedIn()) {
            console.error('Error: You are not logged in to npm. Please run "npm login" first.');
            process.exit(1);
        }

        const currentVersion = getCurrentVersion();
        console.log(`Current version: ${currentVersion}`);
        console.log(`Preparing ${versionType} release...`);

        // Install dependencies
        console.log('\n📦 Installing dependencies...');
        exec('npm install');

        // Process domains
        processDomains();

        // Run tests
        console.log('\n🧪 Running tests...');
        exec('npm test');

        // Update version
        console.log(`\n🔖 Updating version (${versionType})...`);
        exec(`npm version ${versionType} --no-git-tag-version`);

        const newVersion = getCurrentVersion();
        console.log(`Version updated: ${currentVersion} -> ${newVersion}`);

        // Commit changes
        console.log('\n📝 Committing changes...');
        exec('git add .');
        exec(`git commit -m "Release v${newVersion}"`);

        // Create git tag
        console.log('\n🏷️ Creating git tag...');
        exec(`git tag -a v${newVersion} -m "Version ${newVersion}"`);

        // Push to GitHub
        console.log('\n🚀 Pushing to GitHub...');
        exec('git push');
        exec('git push --tags');

        // Publish to npm
        console.log('\n📦 Publishing to npm...');
        exec('npm publish');

        console.log(`\n✅ Release v${newVersion} completed successfully!`);
        console.log('\nNext steps:');
        console.log('  1. Create a release on GitHub: https://github.com/tompec/disposable-email-domains/releases/new');
        console.log(`  2. Select the v${newVersion} tag`);
        console.log('  3. Add release notes describing the changes');
        console.log('  4. Publish the release');

    } catch (error) {
        console.error('Error during release process:', error.message);
        process.exit(1);
    }
}

// Run the release process
release();
