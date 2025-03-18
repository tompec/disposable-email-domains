const fs = require('fs');
const _ = require('lodash');
const validator = require('validator');
const { execSync } = require('child_process');
const { tlds } = require('top-level-domains');

/**
 * Domain Manager - A comprehensive tool for managing disposable email domains
 *
 * This script combines functionality to:
 * 1. Add new domains from contributions
 * 2. Process domains (group by root domains, optimize wildcards)
 * 3. Test domains for validity
 * 4. Sort, deduplicate, and format domains
 */

// Configuration
const CONFIG = {
    indexFile: 'index.json',
    wildcardFile: 'wildcard.json',
    contributionsDir: './contributions',
    contributionsIndexFile: './contributions/index.txt'
};

/**
 * Load domains from files
 */
function loadDomains() {
    console.log('Loading domains...');

    let index = [];
    let wildcard = [];

    try {
        if (fs.existsSync(CONFIG.indexFile)) {
            index = JSON.parse(fs.readFileSync(CONFIG.indexFile, 'utf8'));
            console.log(`Loaded ${index.length} domains from ${CONFIG.indexFile}`);
        } else {
            console.log(`${CONFIG.indexFile} not found, starting with empty index`);
        }

        if (fs.existsSync(CONFIG.wildcardFile)) {
            wildcard = JSON.parse(fs.readFileSync(CONFIG.wildcardFile, 'utf8'));
            console.log(`Loaded ${wildcard.length} domains from ${CONFIG.wildcardFile}`);
        } else {
            console.log(`${CONFIG.wildcardFile} not found, starting with empty wildcard list`);
        }
    } catch (error) {
        console.error(`Error loading domains: ${error.message}`);
        process.exit(1);
    }

    return { index, wildcard };
}

/**
 * Add new domains from contributions
 */
function addContributions(index, wildcard) {
    console.log('Adding contributions...');

    try {
        // Create contributions directory if it doesn't exist
        if (!fs.existsSync(CONFIG.contributionsDir)) {
            fs.mkdirSync(CONFIG.contributionsDir, { recursive: true });
            fs.writeFileSync(CONFIG.contributionsIndexFile, '');
            console.log('Created contributions directory and empty index.txt file');
            return { index, wildcard };
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

    return { index, wildcard };
}

/**
 * Clean and normalize domains
 */
function cleanDomains(index, wildcard) {
    console.log('Cleaning domains...');

    // Remove empty strings
    index = index.filter(d => d);
    wildcard = wildcard.filter(d => d);

    // Lowercase
    index = index.map(domain => _.toLower(domain));
    wildcard = wildcard.map(domain => _.toLower(domain));

    // Sort - using simple lexicographical sorting for compatibility with chai-sorted
    index.sort();
    wildcard.sort();

    // Dedupe
    index = _.uniq(index);
    wildcard = _.uniq(wildcard);

    return { index, wildcard };
}

/**
 * Process domains to optimize wildcards
 */
function processDomains(index, wildcard) {
    console.log('Processing domains...');

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

    // Count domains with multiple subdomains
    let multiSubdomainCount = 0;
    let rootDomainsWithMultipleSubdomains = 0;
    Object.entries(domainGroups).forEach(([rootDomain, domains]) => {
        // Filter out the root domain itself from the group
        const subdomains = domains.filter(domain => domain !== rootDomain);
        if (subdomains.length > 1) {
            // More than one true subdomain
            multiSubdomainCount++;
            rootDomainsWithMultipleSubdomains++;
        }
    });
    console.log(`Found ${multiSubdomainCount} root domains with multiple subdomains`);
    console.log(`Found ${rootDomainsWithMultipleSubdomains} root domains with two or more true subdomains`);

    // Prepare new lists
    const newIndexDomains = [];
    const newWildcardDomains = [...wildcard];
    const movedToWildcard = [];

    // Process each group
    Object.entries(domainGroups).forEach(([rootDomain, domains]) => {
        // Filter out the root domain itself from the group to get only true subdomains
        const subdomains = domains.filter(domain => domain !== rootDomain);

        if (subdomains.length < 2) {
            // Less than two true subdomains with this root, keep them all in index.json
            newIndexDomains.push(...domains);
        } else {
            // Two or more true subdomains with this root
            // Always add the root domain to index.json, regardless of whether it was in the original list
            newIndexDomains.push(rootDomain);

            // Add the root domain to wildcard.json if not already there
            if (!newWildcardDomains.includes(rootDomain)) {
                newWildcardDomains.push(rootDomain);
                movedToWildcard.push(rootDomain);
            }
        }
    });

    // Add unprocessable domains back to index
    newIndexDomains.push(...unprocessableDomains);

    console.log(`Processed ${index.length} domains.`);
    console.log(`New index has ${newIndexDomains.length} domains (${index.length - newIndexDomains.length} fewer).`);
    console.log(`New wildcard has ${newWildcardDomains.length} domains (${newWildcardDomains.length - wildcard.length} more).`);
    console.log(`Moved ${movedToWildcard.length} domains to wildcard.`);

    // Make sure to sort the final lists again
    newIndexDomains.sort();
    newWildcardDomains.sort();

    return {
        index: newIndexDomains,
        wildcard: newWildcardDomains
    };
}

/**
 * Remove domains that are covered by wildcards
 */
function removeWildcardCoveredDomains(index, wildcard) {
    console.log('Removing domains covered by wildcards...');

    const regexp = new RegExp(/(.+(?:\.[\w-]+\.[\w-]+)+)$/);

    const filteredIndex = index.filter(domain => {
        if (regexp.test(domain)) {
            return !wildcard.some(wildcardDomain => {
                return _.endsWith(domain, wildcardDomain);
            });
        }
        return true;
    });

    console.log(`Removed ${index.length - filteredIndex.length} domains covered by wildcards`);

    // Make sure to sort again after filtering
    filteredIndex.sort();

    return {
        index: filteredIndex,
        wildcard
    };
}

/**
 * Test domains for validity
 */
function testDomains(index, wildcard) {
    console.log('Testing domains...');

    const invalidIndex = [];
    const invalidWildcard = [];

    // Test if domains are valid FQDNs
    index.forEach(domain => {
        if (!validator.isFQDN(domain)) {
            invalidIndex.push(domain);
            console.warn(`Invalid domain in index: ${domain}`);
        }
    });

    wildcard.forEach(domain => {
        if (!validator.isFQDN(domain)) {
            invalidWildcard.push(domain);
            console.warn(`Invalid domain in wildcard: ${domain}`);
        }
    });

    // Remove invalid domains
    const validIndex = index.filter(domain => !invalidIndex.includes(domain));
    const validWildcard = wildcard.filter(domain => !invalidWildcard.includes(domain));

    console.log(`Removed ${invalidIndex.length} invalid domains from index`);
    console.log(`Removed ${invalidWildcard.length} invalid domains from wildcard`);

    // Final sort to ensure alphabetical order
    validIndex.sort();
    validWildcard.sort();

    return {
        index: validIndex,
        wildcard: validWildcard
    };
}

/**
 * Save domains to files
 */
function saveDomains(index, wildcard) {
    console.log('Saving domains...');

    // Final sort before saving to ensure alphabetical order
    index.sort();
    wildcard.sort();

    try {
        fs.writeFileSync(CONFIG.indexFile, JSON.stringify(index, null, 2));
        fs.writeFileSync(CONFIG.wildcardFile, JSON.stringify(wildcard, null, 2));

        console.log(`Saved ${index.length} domains to ${CONFIG.indexFile}`);
        console.log(`Saved ${wildcard.length} domains to ${CONFIG.wildcardFile}`);

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
            const testOutput = execSync('npx mocha test/index.js test/wildcard.js', { encoding: 'utf8' });
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
    let { index, wildcard } = loadDomains();

    // Add contributions
    ({ index, wildcard } = addContributions(index, wildcard));

    // Clean domains
    ({ index, wildcard } = cleanDomains(index, wildcard));

    // Process domains (optimize wildcards)
    ({ index, wildcard } = processDomains(index, wildcard));

    // Remove domains covered by wildcards
    ({ index, wildcard } = removeWildcardCoveredDomains(index, wildcard));

    // Test domains
    ({ index, wildcard } = testDomains(index, wildcard));

    // Save domains
    const saveSuccess = saveDomains(index, wildcard);

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
