const puppeteer = require('puppeteer-extra');
const moment = require('moment');
const yargs = require('yargs');
const axios = require('axios');
const delay = require('delay');
const {hideBin} = require('yargs/helpers');
const fs = require('fs');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const {siteLink, generateAccount, settingsPageLink, apiKey} = require('./keys');
let proxies = [];
let accountsCreated = 0;
let numberOfAccounts = 0;
let proxy = false;
const fileName = `${moment().format('MM-DD-YYYY HH-mm-SS')}.csv`;

const argv = yargs(hideBin(process.argv)).argv;

const run = () => new Promise(async (resolve, reject) => {
  try {
    if (argv.accounts) {
      numberOfAccounts = parseInt(argv.accounts)
    } else {
      console.log('Please provide --accounts while starting');
      process.exit(0)
    }
    if (argv.proxy) proxy=true;
    
    console.log('Bot Started...');
    fs.writeFileSync(fileName, '"Email","Password","Phone","First Name","Last Name","DOB","Gender","Country"\r\n');
    puppeteer.use(StealthPlugin());
    if (proxy) await fetchProxies();

    for (let i = 0; i < numberOfAccounts; i++) {
      console.log(`${i+1}/${numberOfAccounts} - Creating Account...`);
      if (proxy) {
        await createAccount(generateAccount(), proxies[getRandomIndex()]);
      } else {
        await createAccount(generateAccount());
      }
    }
    
    console.log(`Number of Accounts created: ${accountsCreated}`);
    console.log('Bot Finished...');
    resolve(true);
  } catch (error) {
    console.log(`Bot Run Error: ${error}`);
    reject(error);
  }
})

const createAccount = (account, proxyInfo = false) => new Promise(async (resolve, reject) => {
  let browser;
  try {
    console.log(account);
    const browserArgs = proxyInfo ? [`--proxy-server=${proxyInfo.address}`] : [];
    browser = await puppeteer.launch({
      headless: false,
      args: browserArgs
    });

    // Launch Page and Goto siteLink
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    if (proxyInfo) await page.authenticate({username: proxyInfo.userName, password: proxyInfo.password});
    await page.goto(siteLink, {timeout: 0, waitUntil: 'load'});

    // Click Accept Cookies Button
    const acceptCookiesButton = await page.$('button[data-qa="accept-cookies"]');
    if(acceptCookiesButton) await page.click('button[data-qa="accept-cookies"]');

    // Navigate to Sign Up
    await page.waitForSelector('button.join-log-in');
    await page.click('button.join-log-in');

    await page.waitForSelector('div.loginJoinLink > a');
    await page.click('div.loginJoinLink > a');
    
    // Fill Form Fields
    await page.waitForSelector('input[name="emailAddress"]');
    await page.type('input[name="emailAddress"]', account.email, {delay: 50});
    await page.type('input[name="password"]', account.password, {delay: 50});
    await page.type('input[name="firstName"]', account.firstName, {delay: 50});
    await page.type('input[name="lastName"]', account.lastName, {delay: 50});
    await page.focus('input[name="dateOfBirth"]');
    await page.keyboard.type(account.year, {delay: 50});
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type(account.month, {delay: 50});
    await page.keyboard.type(account.day, {delay: 50});
    await page.select('select[name="country"]', account.country);
    let genderOptions = await page.$$('ul[data-componentname="gender"] > li');
    for (let i = 0; i < genderOptions.length; i++) {
      const gender = await genderOptions[i].$eval('span', elm => elm.innerText.trim().toLowerCase());
      if (gender == account.gender.toLowerCase()) {
        await genderOptions[i].click('input');
      }
    }
    await page.waitForTimeout(3000);
    genderOptions = await page.$$('ul[data-componentname="gender"] > li');
    for (let i = 0; i < genderOptions.length; i++) {
      const gender = await genderOptions[i].$eval('span', elm => elm.innerText.trim().toLowerCase());
      if (gender == account.gender.toLowerCase()) {
        await genderOptions[i].click('input');
      }
    }
    await page.click('label.checkbox');
    await page.waitForTimeout(3000);

    // Submit the form
    await page.click('input[value="JOIN US"]');
    await page.waitForTimeout(10000);

    // Check if form Submitted
    const gotLogin = await page.$('button.join-log-in');
    if (gotLogin) {
      await browser.close();
      console.log(`Account Creation Failed...`);
      resolve(false);
    } else {
      // Goto Phone Number Settings
      await page.goto(settingsPageLink, {timeout: 0, waitUntil: 'load'});
      await page.waitForSelector('button[aria-label="Add Mobile Number"]');
      await page.click('button[aria-label="Add Mobile Number"]');
      await page.waitForSelector('select.country');

      // Get Number and Verification Code
      let smsCode;
      let numberInfo;
      do {
        await page.evaluate(() => document.querySelector('input.phoneNumber').value="");
        numberInfo = await getNumber();
        await page.select('select.country', numberInfo.country);
        await page.type('input.phoneNumber', numberInfo.number.replace(/\+7/gi, ''), {delay: 50});
        await page.click('input.sendCodeButton');
        smsCode = await getSmsCode(numberInfo);
      } while (smsCode == '');

      // Fill Verification Code
      await page.waitForSelector('input[placeholder="Enter Code"]');
      await page.type('input[placeholder="Enter Code"]', smsCode, {delay: 50});
      await page.click('label.checkbox');
      await page.waitForTimeout(1000);
      await page.click('input[value="CONTINUE"]');
      await page.waitForTimeout(3000);

      await browser.close();
      console.log(`Account Creation Successfull...`);
      accountsCreated++;
      fs.appendFileSync(fileName, `"${account.email}","${account.password}","${numberInfo.number}","${account.firstName}","${account.lastName}","${account.dob}","${account.gender}","${account.country}"\r\n`);
      resolve(true);
    }
  } catch (error) {
    if (browser) await browser.close();
    console.log(`createAccount[${account.email}] Error: `, error.message);
    resolve(false);
  }
});

const fetchProxies = () => new Promise(async (resolve, reject) => {
  try {
    if (!fs.existsSync('proxies.txt')) {
      console.log('proxies.txt not found');
      process.exit(0);
    }
    let proxyText = fs.readFileSync('proxies.txt', 'utf8').split('\n');
    proxies = proxyText.map(p => {
      const proxy = {
        address: '',
        userName: '',
        password: '',
      }
      let pr = p.replace('\r', '');
      pr = pr.split(':');
      proxy.address = pr[0] + ':' + pr[1];
      proxy.userName = pr[2];
      proxy.password = pr[3];
      return proxy;
    });

    console.log(`Number of Proxies found in proxies.txt: ${proxies.length}`);
    console.log(`Number of Accounts to be Created: ${numberOfAccounts}`);
    resolve(true);
  } catch (error) {
    console.log('fetchProxies Error: ', error);
    reject(error);
  }
});

const getRandomIndex = () => {
  return Math.floor(Math.random() * proxies.length);
}

const getNumber = () => new Promise(async (resolve, reject) => {
  try {
    const returnVal = {};
    let resp;
    do {
      // 7 - Russia
      // 1000 - Canada
      resp = await axios.get(`https://onlinesim.ru/api/getNum.php?apikey=${apiKey}&country=7&service=nike&number=true`);
    } while (resp.data.response !== 1);
    returnVal.tzid = resp.data.tzid;
    returnVal.number = resp.data.params ? resp.data.params.number : resp.data.number;
    returnVal.country = 'RU';

    resolve(returnVal);
  } catch (error) {
    console.log('getNumber Error: ', error);
    reject(error);
  }
});

const getSmsCode = (numberInfo) => new Promise(async (resolve, reject) => {
  try {
    let returnVal = '';
    for (let i = 0; i < 15; i++) {
      await delay(2000);
      const response = await axios.get(`https://onlinesim.ru/api/getState.php?apikey=${apiKey}&tzid=${numberInfo.tzid}&message_to_code=1&form=1&msg_list=0`);
      if (response.data[0].msg) {
        returnVal = response.data[0].msg;
        break;
      }
    }

    resolve(returnVal);
  } catch (error) {
    console.log('getSmsCode Error: ', error);
    reject(error);
  }
});

run();