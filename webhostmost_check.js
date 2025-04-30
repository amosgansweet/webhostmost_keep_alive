const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

(async () => {
  const username = process.env.WEBHOSTMOST_USERNAME;
  const password = process.env.WEBHOSTMOST_PASSWORD;
  const url = 'https://client.webhostmost.com/login';
  let loginSuccessful = false;
  let statusMessage = "Webhostmost Status: ";

  if (!username || !password) {
    console.error('Error: WEBHOSTMOST_USERNAME and WEBHOSTMOST_PASSWORD environment variables must be set.');
    statusMessage = 'Error: Missing credentials.';
    console.log(`::set-output name=status::${statusMessage}`); // Output immediately
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

    await page.goto(url, { waitUntil: 'networkidle2' });

    const token = await page.evaluate(() => {
      const tokenInput = document.querySelector('input[name="token"]');
      return tokenInput ? tokenInput.value : null;
    });

    if (!token) {
      throw new Error('CSRF token not found.');
    }

    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);

    const formData = `token=${token}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    await Promise.all([
      page.evaluate((formData) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/login';
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

    const content = await page.content();
    const $ = cheerio.load(content);

    let suspensionTime = 'Not Found';
    const suspensionElement = $('div:contains("Time until suspension:")');

    if (suspensionElement.length > 0) {
      const fullText = suspensionElement.text();
      const parts = fullText.split(':');
      if (parts.length > 1) {
        suspensionTime = parts[1].trim();
      }
    }

    console.log(`Time until suspension: ${suspensionTime}`);
    statusMessage = `Login successful. Time until suspension: ${suspensionTime}`;
  } catch (error) {
    loginSuccessful = false;
    console.error('An error occurred:', error);
    statusMessage = `Login failed: ${error.message}`;
  } finally {
    if (browser) {
      await browser.close();
    }
    statusMessage = statusMessage.replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Sanitize
    statusMessage = statusMessage.trim(); // Trim

    console.log(`::set-output name=status::${statusMessage}`); // Output the status
  }
})();
