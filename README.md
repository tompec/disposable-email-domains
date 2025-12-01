# Disposable Email Domains

A list of [disposable email domains](http://en.wikipedia.org/wiki/Disposable_email_address) (like `mailinator.com`) commonly used to create temporary accounts. Use this list to detect or block fake accounts during your signup process.

## Installation

```bash
npm install disposable-domains
```

## Usage

This package exports an array of domains. You can check if an email domain exists in the list:

```js
const disposableDomains = require('disposable-domains');
const emailDomain = 'something.mailinator.com'; 

// Check if the exact domain OR the root domain is in the list
const isDisposable = disposableDomains.some(domain => 
  emailDomain === domain || emailDomain.endsWith('.' + domain)
);

if (isDisposable) {
  console.log('Blocked.');
}
```

### How the list works

The entries in `index.json` should be treated as **domain suffixes**. 

This means you should block the exact domain match **and** any subdomain to the left of it (a recursive wildcard match).

- **Matches:** `mailinator.com`
- **Also Matches:** `sub.mailinator.com`, `a.b.mailinator.com`

## Contributing

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add domains to [contributions/index.txt](https://github.com/tompec/disposable-email-domains/blob/main/contributions/index.txt):
   - One domain per line
   - No extra formatting

3. Build the list:

   ```bash
   npm run process
   ```

   This validates, sorts, and deduplicates your entries.

## License

MIT — see [LICENSE](LICENSE) for details.

```
WWWWWW||WWWWWW
 W W W||W W W
      ||
    ( OO )__________
     /  |           \
    /o o|    MIT     \
    \___/||_||__||_|| *
         || ||  || ||
        _||_|| _||_||
       (__|__|(__|__|
```
