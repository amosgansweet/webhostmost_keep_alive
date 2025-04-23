const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;

(async () => {
  const username = process.env.WEBHOSTMOST_USERNAME;
  const password = process.env.WEBHOSTMOST_PASSWORD;
  const url = 'https://client.webhostmost.com/clientarea.php';

  if (!username || !password) {
    console.error('Error: WEBHOSTMOST_USERNAME and WEBHOSTMOST_PASSWORD environment variables must be set.');
    await fs.writeFile('status.txt', 'Error: Missing credentials.');
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", // Run in headless mode (no GUI)
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for running in GitHub Actions
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 }); // Set viewport

    // 1. Go to the login page
    await page.goto(url);

    // 2. Fill in the login form
    await page.type('input[name="email"]', username); // Adjust selector if needed
    await page.type('input[name="password"]', password); // Adjust selector if needed

    // 3. Click the login button
    await Promise.all([
      page.click('button[type="submit"]'), // Adjust selector if needed
      page.waitForNavigation({ waitUntil: 'networkidle2' }), // Wait for navigation
    ]);

    // 4. Extract the HTML content after login
    const content = await page.content();

    // 5. Use Cheerio to parse the HTML
    const $ = cheerio.load(content);

    // 6. Find the element containing the status
    //  This selector is based on the image you provided.  Inspect the page
    //  source in your browser and adjust the selector if it changes.
    let statusElement = $('div:contains("Your Hosting Plans")').next().find('div:contains("Active")'); // Adjust the selector.  Be specific!
    let status = 'Not Found';

    if (statusElement.length > 0) {
      status = 'Active';
    } else {
      status = 'Inactive';
    }

    console.log(`Hosting Plan Status: ${status}`);
    await fs.writeFile('status.txt', `Hosting Plan Status: ${status}`);  // Save status to file

  } catch (error) {
    console.error('An error occurred:', error);
    await fs.writeFile('status.txt', `Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
