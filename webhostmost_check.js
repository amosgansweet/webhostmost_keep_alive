const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

const username = process.env.WEBHOSTMOST_USERNAME;
const password = process.env.WEBHOSTMOST_PASSWORD;
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    // 访问登录页
    await page.goto('https://client.webhostmost.com/login.php', { waitUntil: 'networkidle2' });

    // 填写登录表单
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    // 访问 clientarea 页面
    await page.goto('https://client.webhostmost.com/clientarea.php', { waitUntil: 'networkidle2' });

    // 等待倒计时 DOM 出现
    await page.waitForSelector('#custom-timer', { timeout: 10000 });

    // 提取倒计时内容
    const suspensionTime = await page.evaluate(() => {
      const days = document.getElementById('timer-days')?.innerText || '0';
      const hours = document.getElementById('timer-hours')?.innerText || '0';
      const minutes = document.getElementById('timer-minutes')?.innerText || '0';
      const seconds = document.getElementById('timer-seconds')?.innerText || '0';
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    });

    const statusMessage = `Login successful. Time until suspension: ${suspensionTime}`;
    console.log(statusMessage);

    // 可选：发送 Telegram 消息
    if (telegramToken && telegramChatId) {
      const bot = new TelegramBot(telegramToken);
      await bot.sendMessage(telegramChatId, statusMessage);
    }
  } catch (error) {
    console.error('Error during login and check:', error.message);

    if (telegramToken && telegramChatId) {
      const bot = new TelegramBot(telegramToken);
      await bot.sendMessage(telegramChatId, `Login check failed: ${error.message}`);
    }

    process.exitCode = 1; // GitHub Actions 会认为失败
  } finally {
    await browser.close();
  }
})();
