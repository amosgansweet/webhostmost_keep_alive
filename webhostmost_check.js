const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;

(async () => {
  const username = process.env.WEBHOSTMOST_USERNAME;
  const password = process.env.WEBHOSTMOST_PASSWORD;
  const url = 'https://client.webhostmost.com/login';
  let loginSuccessful = false;

  if (!username || !password) {
    console.error('Error: WEBHOSTMOST_USERNAME and WEBHOSTMOST_PASSWORD environment variables must be set.');
    await fs.writeFile('status.txt', 'Error: Missing credentials.');
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.deleteCookie(...await page.cookies());
    await page.setCacheEnabled(false);

    // 1. Go to the login page
    await page.goto(url, { waitUntil: 'networkidle2' });

    // 2. Extract the CSRF token
    const token = await page.evaluate(() => {
      const tokenInput = document.querySelector('input[name="token"]'); // Adjust selector if needed
      return tokenInput ? tokenInput.value : null;
    });

    if (!token) {
      throw new Error('CSRF token not found.');
    }

    // 3. Fill in the login form and submit
    await page.type('input[name="username"]', username); // Use name attribute
    await page.type('input[name="password"]', password); // Use name attribute

    // Construct the form data
    const formData = `token=${token}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    // Click the login button (assuming a standard submit button)
    await Promise.all([
      page.evaluate((formData) => {
        // Create a hidden form and submit it
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/login';  // Relative URL
        form.style.display = 'none';

        const params = new URLSearchParams(formData);
        for (const [key, value] of params) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
      }, formData),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    loginSuccessful = true;

    // Add a random delay (between 2 and 5 seconds)
    const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; // Random delay between 2 and 5 seconds
    console.log(`Waiting for ${delay}ms before extracting data...`);
    await page.waitForTimeout(delay);

    // 4. Extract the HTML content after login
    const content = await page.content();

    // 5. Use Cheerio to parse the HTML
    const $ = cheerio.load(content);

    // 6. Extract the "Time until suspension" from the span elements
    const days = $('#timer-days').text();
    const hours = $('#timer-hours').text();
    const minutes = $('#timer-minutes').text();
    const seconds = $('#timer-seconds').text();

    const suspensionTime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    console.log(`Time until suspension: ${suspensionTime}`);
    await fs.writeFile('status.txt', `Time until suspension: ${suspensionTime}`);

  } catch (error) {
    loginSuccessful = false;
    console.error('An error occurred:', error);
    await fs.writeFile('status.txt', `Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }

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

    try {
      await fs.writeFile('status.txt', statusMessage);
      console.log("Final Status Message:", statusMessage);
    } catch (writeError) {
      console.error("Error writing final status to file:", writeError);
    }
  }
})();
