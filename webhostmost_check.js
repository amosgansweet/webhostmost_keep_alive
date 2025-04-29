const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;

(async () => {
  const username = process.env.WEBHOSTMOST_USERNAME;
  const password = process.env.WEBHOSTMOST_PASSWORD;
  const url = 'https://client.webhostmost.com/login'; //Corrected URL
  let loginSuccessful = false; // Track login status

  if (!username || !password) {
    console.error('Error: WEBHOSTMOST_USERNAME and WEBHOSTMOST_PASSWORD environment variables must be set.');
    await fs.writeFile('status.txt', 'Error: Missing credentials.');
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", // Run in headless mode (no GUI)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security', // Important for bypassing some CORS issues
        '--disable-features=IsolateOrigins', //Related to web security
        '--disable-site-isolation-trials', //Related to web security
      ],
      ignoreDefaultArgs: ['--enable-automation'], // Try to avoid detection
      // executablePath: '/usr/bin/chromium-browser', // Specify Chromium path if needed in GH Actions
    });

    const page = await browser.newPage();

    //Emulate a real browser as closely as possible
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 }); // Set viewport
    await page.evaluateOnNewDocument(() => {
      // Pass webdriver check
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Simulate private browsing (more aggressively)
    await page.deleteCookie(...await page.cookies()); // Clear all cookies
    await page.setCacheEnabled(false); // Disable caching

    // 1. Go to the login page (Corrected URL)
    await page.goto(url, { waitUntil: 'networkidle2' }); // Wait for navigation

    // 2. Fill in the login form (CORRECTED SELECTORS)
    await page.type('input[placeholder="Email Address"]', username); // Adjust selector if needed
    await page.type('input[placeholder="Password"]', password); // Adjust selector if needed
    // 3. Click the login button
    await Promise.all([
      page.click('button:contains("Login")'), // Adjust selector if needed
      page.waitForNavigation({ waitUntil: 'networkidle2' }), // Wait for navigation
    ]);

    loginSuccessful = true; // Login was successful

    // 4. Extract the HTML content after login
    const content = await page.content();

    // 5. Use Cheerio to parse the HTML
    const $ = cheerio.load(content);

    // 6. Extract the "Time until suspension" (Adjusted selector to new page)
      let suspensionTime = 'Not Found';
      const suspensionElement = $('div:contains("Time until suspension:")');

      if (suspensionElement.length > 0) {
        // Extract the text and split it to get the time
        const fullText = suspensionElement.text();
        const parts = fullText.split(':');
        if (parts.length > 1) {
          suspensionTime = parts[1].trim(); // Get the part after "Time until suspension:"
        }
      }

    console.log(`Time until suspension: ${suspensionTime}`);
    await fs.writeFile('status.txt', `Time until suspension: ${suspensionTime}`);  // Save status to file

  } catch (error) {
    loginSuccessful = false; // Login failed due to an error
    console.error('An error occurred:', error);
    await fs.writeFile('status.txt', `Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Construct the status message
    let statusMessage = "Webhostmost Status: ";
    if (loginSuccessful) {
      statusMessage += "Login successful. Time until suspension: ";
      try {
        const statusFromFile = await fs.readFile('status.txt', 'utf8');
        statusMessage += statusFromFile;
      } catch (readError) {
        statusMessage += "Unknown (Error reading status file)";
        console.error("Error reading status file:", readError);
      }
    } else {
      statusMessage += "Login failed. Please check your credentials or the website.";
    }

    // Write the final status message to status.txt
    try {
      await fs.writeFile('status.txt', statusMessage);
      console.log("Final Status Message:", statusMessage);  // Log the message
    } catch (writeError) {
      console.error("Error writing final status to file:", writeError);
    }

  }
})();
