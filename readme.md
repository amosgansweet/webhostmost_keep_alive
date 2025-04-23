1. Set up Secrets in your GitHub Repository:

Go to your GitHub repository.
Click on "Settings".
Click on "Secrets and variables" -> "Actions".
Click "New repository secret".
Create the following secrets:
WEBHOSTMOST_USERNAME: Your webhostmost username/email.
WEBHOSTMOST_PASSWORD: Your webhostmost password.
2. Create a GitHub Actions Workflow File:

Create a new file in your repository at .github/workflows/webhostmost_login.yml.
3. Workflow YAML File (.github/workflows/webhostmost_login.yml):
4. Node.js Script (webhostmost_check.js):
5. Explanation:

YAML Workflow:
name: A descriptive name for your workflow.
on: Defines when the workflow should run. schedule uses a cron expression to run every 10 days. workflow_dispatch allows you to manually trigger the workflow from the GitHub Actions UI.
jobs: Defines the tasks to be performed.
runs-on: Specifies the operating system to use (Ubuntu in this case).
steps: A sequence of actions:
actions/checkout: Checks out your repository code.
actions/setup-node: Sets up Node.js.
npm install: Installs the puppeteer and cheerio packages.
Run login and status check script: Executes the webhostmost_check.js script. Critically, it passes the username and password as environment variables from the GitHub Secrets.
Send Status Update (Optional): This section reads the status.txt file created by the script and sets the STATUS_MESSAGE environment variable. The if: always() ensures it runs even if the previous steps failed. I've provided a template for sending the status to another service (email, Slack, etc.) below. Remove this whole section if you don't need it.
Output Status: Prints the status to the console.
Node.js Script (webhostmost_check.js):
puppeteer.launch(): Launches a headless Chrome browser. The --no-sandbox and --disable-setuid-sandbox arguments are often necessary for running Puppeteer in containerized environments like GitHub Actions.
page.goto(): Navigates to the login page.
page.type(): Fills in the username and password fields. Important: Inspect the HTML source of the login form on the website and adjust the selectors (input[name="email"], input[name="password"]) if they are different.
page.click(): Clicks the login button. Again, inspect the HTML and adjust the selector if needed.
page.waitForNavigation(): Waits for the page to load after login.
page.content(): Gets the HTML content of the page.
cheerio.load(): Parses the HTML content using Cheerio (a library similar to jQuery for the server-side).
$('...'): Uses Cheerio selectors to find the element containing the hosting plan status. This is the most critical part to adjust. You need to find a reliable CSS selector that uniquely identifies the element that displays the "Active" or "Inactive" status of your hosting plan. Inspect the HTML source code of the page after you've logged in and determine the correct selector. The example selector $('div:contains("Your Hosting Plans")').next().find('div:contains("Active")') is a guess based on your screenshot and is unlikely to be correct.
The script then extracts the text from the status element and writes it to status.txt.
Error Handling: The try...catch...finally block ensures that the browser is closed even if an error occurs.
6. Important Considerations and Improvements:

Selector Specificity: The key to making this work reliably is to use a very specific CSS selector to find the status element. Use your browser's developer tools to inspect the HTML and create a selector that is unlikely to change.
Error Handling: Add more robust error handling. For example, check if the login was successful before attempting to extract the status. You could look for a specific element on the page that only appears after a successful login.
Website Changes: Be aware that if the website's HTML structure changes, you'll need to update the selectors in the script. Set up monitoring (e.g., using a service like Sentry) to alert you if the script starts failing.
CAPTCHAs: If the website uses CAPTCHAs, this approach will not work without additional CAPTCHA solving services (which can be complex and expensive).
Two-Factor Authentication: If you have two-factor authentication enabled on your webhostmost account, this script will not be able to log in. You'll need to disable two-factor authentication or find a more advanced solution that can handle it.
Rate Limiting: Be mindful of the website's rate limits. If you make too many login attempts in a short period of time, your IP address might get blocked. You could add a delay between login attempts or use a proxy server.
Security: While GitHub Secrets are encrypted, it's always a good idea to use strong passwords and enable two-factor authentication on your GitHub account.
8. Commit and Push:

Commit your changes to the .github/workflows/webhostmost_login.yml and webhostmost_check.js files and push them to your GitHub repository.

9. Monitor the Workflow:

Go to the "Actions" tab in your GitHub repository to monitor the workflow's execution. Check the logs for any errors.

Troubleshooting:

"Puppeteer not found": Make sure you've installed the dependencies (npm install puppeteer cheerio).
"Cannot find element": Double-check your CSS selectors. Use your browser's developer tools to inspect the HTML and make sure the selectors are correct.
"Login failed": Verify that your username and password are correct and that you don't have two-factor authentication enabled.
"Timeout": Increase the waitForNavigation timeout if the page is taking a long time to load.
This is a complex task, and you may need to adjust the code based on the specific website's structure and behavior. Start with the basic workflow and gradually add more features and error handling as needed. Good luck!
