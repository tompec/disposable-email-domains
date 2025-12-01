const fs = require('fs');
const _ = require('lodash');
const validator = require('validator');
const { execSync } = require('child_process');
const { tlds } = require('top-level-domains');
const path = require('path');

/**
 * Domain Manager - A comprehensive tool for managing disposable email domains
 *
 * This script combines functionality to:
 * 1. Add new domains from contributions
 * 2. Process domains (group by root domains)
 * 3. Test domains for validity
 * 4. Sort, deduplicate, and format domains
 */

// Get the root directory
const rootDir = path.join(__dirname, '..');

// Configuration with updated paths
const CONFIG = {
    indexFile: path.join(rootDir, 'index.json'),
    contributionsDir: path.join(rootDir, 'contributions'),
    contributionsIndexFile: path.join(rootDir, 'contributions', 'index.txt')
};

/**
 * Load domains from files
 */
function loadDomains() {
    console.log('Loading domains...');

    let index = [];

    try {
        if (fs.existsSync(CONFIG.indexFile)) {
            index = JSON.parse(fs.readFileSync(CONFIG.indexFile, 'utf8'));
            console.log(`Loaded ${index.length} domains from ${CONFIG.indexFile}`);
        } else {
            console.log(`${CONFIG.indexFile} not found, starting with empty index`);
        }
    } catch (error) {
        console.error(`Error loading domains: ${error.message}`);
        process.exit(1);
    }

    return { index };
}

/**
 * Add new domains from contributions
 */
function addContributions(index) {
    console.log('Adding contributions...');

    try {
        // Create contributions directory if it doesn't exist
        if (!fs.existsSync(CONFIG.contributionsDir)) {
            fs.mkdirSync(CONFIG.contributionsDir, { recursive: true });
            fs.writeFileSync(CONFIG.contributionsIndexFile, '');
            console.log('Created contributions directory and empty index.txt file');
            return index;
        }

        // Add new domains from contributions
        if (fs.existsSync(CONFIG.contributionsIndexFile)) {
            const newDomains = fs.readFileSync(CONFIG.contributionsIndexFile, 'utf8')
                .split('\n')
                .filter(d => d);

            if (newDomains.length > 0) {
                console.log(`Adding ${newDomains.length} new domains from contributions`);
                index = _.concat(index, newDomains);
            }
        }
    } catch (error) {
        console.error(`Error adding contributions: ${error.message}`);
    }

    return index;
}

/**
 * Clean and normalize domains
 */
function cleanDomains(index) {
    console.log('Cleaning domains...');

    // Remove empty strings
    index = index.filter(d => d);

    // Lowercase
    index = index.map(domain => _.toLower(domain));

    // Sort - using simple lexicographical sorting for compatibility with chai-sorted
    index.sort();

    // Dedupe
    index = _.uniq(index);

    return index;
}

/**
 * Process domains to optimize root coverage
 */
function processDomains(index) {
    console.log('Processing domains and collapsing roots when many subdomains are present...');

    // Get TLD list from the installed package
    console.log('Using TLD list from top-level-domains package');
    const tldList = tlds.map(item => item.tld);
    tldList.sort((a, b) => b.length - a.length); // Sort by length (longest first)
    console.log(`Loaded ${tldList.length} TLDs from package`);

    // Function to extract TLD and SLD from a domain
    function extractTldAndSld(domain) {
        // Find the matching TLD
        let matchedTld = null;
        for (const tld of tldList) {
            if (domain.endsWith(`.${tld}`)) {
                matchedTld = tld;
                break;
            }
        }

        // If no TLD match found, try to use the last part as TLD
        if (!matchedTld) {
            const parts = domain.split('.');
            if (parts.length >= 2) {
                matchedTld = parts[parts.length - 1];
            } else {
                // Can't extract TLD
                return null;
            }
        }

        // Extract SLD (second-level domain)
        const tldPart = `.${matchedTld}`;
        const domainWithoutTld = domain.slice(0, -tldPart.length);
        const parts = domainWithoutTld.split('.');

        if (parts.length === 1) {
            // This is already a root domain (SLD + TLD)
            return {
                tld: matchedTld,
                sld: parts[0],
                rootDomain: domain
            };
        } else {
            // This is a subdomain
            const sld = parts[parts.length - 1];
            const rootDomain = `${sld}${tldPart}`;
            return {
                tld: matchedTld,
                sld: sld,
                rootDomain: rootDomain
            };
        }
    }

    // Group domains by root domain
    const domainGroups = {};
    const unprocessableDomains = [];

    index.forEach(domain => {
        const extracted = extractTldAndSld(domain);
        if (extracted) {
            const key = extracted.rootDomain;
            if (!domainGroups[key]) {
                domainGroups[key] = [];
            }
            domainGroups[key].push(domain);
        } else {
            unprocessableDomains.push(domain);
            console.warn(`Could not process domain: ${domain}`);
        }
    });

    console.log(`Grouped domains into ${Object.keys(domainGroups).length} root domains`);
    console.log(`Found ${unprocessableDomains.length} unprocessable domains`);

    // Prepare new lists
    const newIndexDomains = [];
    let collapsedToRootCount = 0;
    let rootsCollapsed = 0;
    const collapseThreshold = 3; // collapse to root when 3+ subdomains share the root

    // Process each group
    Object.entries(domainGroups).forEach(([rootDomain, domains]) => {
        // Filter out the root domain itself from the group to get only true subdomains
        const subdomains = domains.filter(domain => domain !== rootDomain);

        const hasExplicitRoot = domains.includes(rootDomain);
        const shouldCollapse = subdomains.length >= collapseThreshold;

        if (hasExplicitRoot && subdomains.length > 0) {
            // Root explicitly listed: keep root, drop subdomains
            rootsCollapsed++;
            newIndexDomains.push(rootDomain);
            collapsedToRootCount += subdomains.length;
            return;
        }

        if (!hasExplicitRoot && shouldCollapse) {
            // Collapse when 3+ subdomains share a root
            rootsCollapsed++;
            newIndexDomains.push(rootDomain);
            collapsedToRootCount += subdomains.length;
            return;
        }

        // Otherwise keep whatever was listed (root-only or few subdomains)
        newIndexDomains.push(...domains);
    });

    // Add unprocessable domains back to index
    newIndexDomains.push(...unprocessableDomains);

    console.log(`Processed ${index.length} domains.`);
    console.log(`New index has ${newIndexDomains.length} domains (${index.length - newIndexDomains.length} fewer).`);
    console.log(`Collapsed ${collapsedToRootCount} subdomains into root coverage across ${rootsCollapsed} roots (threshold ${collapseThreshold} subdomains).`);

    // Make sure to sort the final lists again
    newIndexDomains.sort();

    return {
        index: newIndexDomains
    };
}

/**
 * Test domains for validity
 */
function testDomains(index) {
    console.log('Testing domains...');

    const invalidIndex = [];

    // Test if domains are valid FQDNs
    index.forEach(domain => {
        if (!validator.isFQDN(domain)) {
            invalidIndex.push(domain);
            console.warn(`Invalid domain in index: ${domain}`);
        }
    });

    const validIndex = index.filter(domain => !invalidIndex.includes(domain));

    console.log(`Removed ${invalidIndex.length} invalid domains from index`);

    // Final sort to ensure alphabetical order
    validIndex.sort();

    return {
        index: validIndex
    };
}

/**
 * Save domains to files
 */
function saveDomains(index) {
    console.log('Saving domains...');

    // Final sort before saving to ensure alphabetical order
    index.sort();

    try {
        fs.writeFileSync(CONFIG.indexFile, JSON.stringify(index, null, 2));

        console.log(`Saved ${index.length} domains to ${CONFIG.indexFile}`);

        // Clear contribution files after successful save
        if (fs.existsSync(CONFIG.contributionsIndexFile)) {
            fs.writeFileSync(CONFIG.contributionsIndexFile, '');
        }

        return true;
    } catch (error) {
        console.error(`Error saving domains: ${error.message}`);
        return false;
    }
}

/**
 * Run tests on the domains
 */
function runTests() {
    console.log('Running tests...');

    try {
        // Check if mocha is installed
        try {
            execSync('npx mocha --version', { stdio: 'ignore' });
        } catch (error) {
            console.error('Mocha is not installed. Please install it with: npm install --save-dev mocha');
            return false;
        }

        // Run the tests
        try {
            const testCommand = `cd ${rootDir} && npx mocha test/index.js`;
            const testOutput = execSync(testCommand, { encoding: 'utf8' });
            console.log(testOutput);
            return true;
        } catch (error) {
            console.error('Tests failed:');
            console.error(error.stdout);
            return false;
        }
    } catch (error) {
        console.error(`Error running tests: ${error.message}`);
        return false;
    }
}

/**
 * Main function
 */
function main() {
    console.log('=== Domain Manager ===');

    // Load domains
    let { index } = loadDomains();

    // Add contributions
    index = addContributions(index);

    // Clean domains
    index = cleanDomains(index);

    // Process domains (collapse roots when many subdomains appear)
    ({ index } = processDomains(index));

    // Test domains
    ({ index } = testDomains(index));

    // Save domains
    const saveSuccess = saveDomains(index);

    // Run tests
    if (saveSuccess) {
        const testsSuccess = runTests();
        if (testsSuccess) {
            console.log('All tests passed!');
        } else {
            console.error('Tests failed!');
            process.exit(1);
        }
    }

    console.log('Done!');
}

// Run the main function
main();
