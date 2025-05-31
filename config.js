// sayecho-bot/config.js
require("dotenv").config();
// No path needed for utils if it's in the same directory and used by this file.
// However, config.js as provided previously doesn't directly use utils.js's log function.

const config = {
  apiBaseUrl: "https://api.sayecho.xyz",

  useProxy: process.env.SAYECHO_USE_PROXY
    ? process.env.SAYECHO_USE_PROXY.toLowerCase() === "true"
    : false,
  globalProxyUrl: process.env.SAYECHO_GLOBAL_PROXY_URL || null,

  delayBetweenActions: [
    parseInt(process.env.SAYECHO_DELAY_MIN_ACTIONS, 10) || 3,
    parseInt(process.env.SAYECHO_DELAY_MAX_ACTIONS, 10) || 7,
  ],
  delayAfterVisit: [
    parseInt(process.env.SAYECHO_DELAY_MIN_VISIT, 10) || 5,
    parseInt(process.env.SAYECHO_DELAY_MAX_VISIT, 10) || 10,
  ],
  puppeteerHeadless: process.env.SAYECHO_PUPPETEER_HEADLESS
    ? process.env.SAYECHO_PUPPETEER_HEADLESS.toLowerCase() === "true"
    : true,

  performMeCheck: process.env.SAYECHO_PERFORM_ME_CHECK
    ? process.env.SAYECHO_PERFORM_ME_CHECK.toLowerCase() === "true"
    : true,
  fetchQuests: process.env.SAYECHO_FETCH_QUESTS
    ? process.env.SAYECHO_FETCH_QUESTS.toLowerCase() === "true"
    : true,
  completeCheckOutPosts: process.env.SAYECHO_COMPLETE_CHECK_OUT_POSTS
    ? process.env.SAYECHO_COMPLETE_CHECK_OUT_POSTS.toLowerCase() === "true"
    : true,
  claimDailyWaves: process.env.SAYECHO_CLAIM_DAILY_WAVES
    ? process.env.SAYECHO_CLAIM_DAILY_WAVES.toLowerCase() === "true"
    : true,
  visitExternalLinks: process.env.SAYECHO_VISIT_EXTERNAL_LINKS
    ? process.env.SAYECHO_VISIT_EXTERNAL_LINKS.toLowerCase() === "true"
    : false,

  delayBetweenAccounts: [
    parseInt(process.env.SAYECHO_DELAY_MIN_ACCOUNTS, 10) || 2,
    parseInt(process.env.SAYECHO_DELAY_MAX_ACCOUNTS, 10) || 5,
  ],
  timeSleepMinutesAtCycleEnd:
    parseInt(process.env.SAYECHO_CYCLE_SLEEP_MINUTES, 10) || 60,

  maxThreads:
    process.env.SAYECHO_USE_PROXY &&
    process.env.SAYECHO_USE_PROXY.toLowerCase() === "true"
      ? parseInt(process.env.SAYECHO_MAX_THREADS, 10) || 3
      : parseInt(process.env.SAYECHO_MAX_THREADS_NO_PROXY, 10) || 1,
};

module.exports = config;
