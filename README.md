# Disposable Email Domains


A list of [disposable email domains](http://en.wikipedia.org/wiki/Disposable_email_address) like `mailinator.com`. You can use it to detect or block disposable accounts in your signup process. Exact domain matches are found in [index.json](https://github.com/tompec/disposable-email-domains/blob/main/index.json) and wildcard domains (ex: `*.33mail.com`) are in [wildcard.json](https://github.com/tompec/disposable-email-domains/blob/main/wildcard.json).

## Examples

### Node.JS
```js
var domains = require('disposable-domains');
var wildcards = require('disposable-domains/wildcard.json');

// ... your code here
```

## Installation
  
```
$ npm install disposable-domains
```

## Contributing

1. Install dependencies:
   ```
   npm install
   ```

2. Add your disposable domains to [contributions/index.txt](https://github.com/tompec/disposable-email-domains/blob/main/contributions/index.txt) (one domain per line, without any additional formatting)

3. Run the [domain manager script](https://github.com/tompec/disposable-email-domains/blob/main/scripts/domain-manager.js):
   ```
   npm run process
   ```
   That script will:
   - Add your domains to index.json
   - Validate domains using the FQDN (Fully Qualified Domain Name) standard
   - Move domains to wildcard.json if they have 2 or more subdomains
   - Sort and deduplicate all entries
   - Run the tests to ensure everything is working correctly

## License

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

THE SOFTWARE IS PROVIDED "AS IS" AND "AS AND WHEN AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
