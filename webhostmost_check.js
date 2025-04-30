const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

const username = process.env.WEBHOSTMOST_USERNAME;
const password = process.env.WEBHOSTMOST_PASSWORD;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://client.webhostmost.com/login.php');

  await page.type('#inputEmail', username);
  await page.type('#inputPassword', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' })
  ]);

  const timerSelector = '#custom-timer';
  try {
    await page.waitForSelector(timerSelector, { timeout: 5000 });

    const timeText = await page.evaluate(() => {
      const days = document.querySelector('#timer-days')?.textContent || '0';
      const hours = document.querySelector('#timer-hours')?.textContent || '0';
      const minutes = document.querySelector('#timer-minutes')?.textContent || '0';
      const seconds = document.querySelector('#timer-seconds')?.textContent || '0';
      return `Login successful. Time until suspension: ${days}d ${hours}h ${minutes}m ${seconds}s`;
    });

    const bot = new TelegramBot(botToken);
    await bot.sendMessage(chatId, timeText);
    console.log(timeText);
  } catch (error) {
    const bot = new TelegramBot(botToken);
    const failMessage = 'Login failed or timer not found.';
    await bot.sendMessage(chatId, failMessage);
    console.error(failMessage);
  } finally {
    await browser.close();
  }
})();
