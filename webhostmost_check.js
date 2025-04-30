const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

(async () => {
  const username = process.env.WEBHOSTMOST_USERNAME;
  const password = process.env.WEBHOSTMOST_PASSWORD;
  const url = 'https://client.webhostmost.com/login';
  let statusMessage = "Webhostmost Status: ";

  if (!username || !password) {
    statusMessage = 'Error: Missing credentials.';
    fs.appendFileSync(process.env.GITHUB_ENV, `STATUS=${statusMessage}\n`);
    process.exit(1);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto(url, { waitUntil: 'networkidle2' });

    const token = await page.evaluate(() => {
      const tokenInput = document.querySelector('input[name="token"]');
      return tokenInput ? tokenInput.value : null;
    });

    if (!token) throw new Error('CSRF token not found');

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

    const content = await page.content();
    const $ = cheerio.load(content);

    let suspensionTime = 'Not Found';
    const suspensionElement = $('div:contains("Time until suspension:")').first();
    if (suspensionElement.length > 0) {
      const textOnly = suspensionElement.clone().children().remove().end().text();
      const match = textOnly.match(/Time until suspension:\s*(.+)/);
      if (match && match[1]) {
        suspensionTime = match[1].trim();
      }
    }

    statusMessage = `Login successful. Time until suspension: ${suspensionTime}`;
  } catch (err) {
    statusMessage = `Login failed: ${err.message}`;
  } finally {
    if (browser) await browser.close();
    statusMessage = statusMessage.replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    statusMessage = statusMessage.slice(0, 1000); // 防止超长

    fs.appendFileSync(process.env.GITHUB_ENV, `STATUS=${statusMessage}\n`);
  }
})();
