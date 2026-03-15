import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}:`, msg.text());
  });
  
  page.on('pageerror', err => {
    console.error('[BROWSER ERROR]', err);
  });
  
  page.on('requestfailed', request => {
    console.error(`[NETWORK FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('Navigating to http://localhost:5502 ...');
  try {
    await page.goto('http://localhost:5502', { waitUntil: 'load', timeout: 10000 });
  } catch (err) {
    console.error('[GOTO ERROR]', err);
  }
  
  console.log('Waiting 3 seconds for app to initialize...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await browser.close();
  console.log('Done.');
})();
