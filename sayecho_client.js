// sayecho-bot/sayecho_client.js
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const puppeteer = require("puppeteer");
const config = require("./config"); // Updated path
const userAgents = require("./userAgents"); // Updated path
const {
  sleep,
  getRandomNumber,
  log: utilLogFromUtils,
  isSayEchoTokenExpired,
} = require("./utils"); // Updated path

class SayEchoClientAPI {
  constructor(accountIndex = 0, bearerToken, proxyUrl = null) {
    this.accountIndexForLog = accountIndex;
    this.accountIdentifier = `${this.accountIndexForLog + 1}`;
    this.sayechoToken = bearerToken;
    this.proxyUrl = proxyUrl;

    this.sayechoBaseURL = config.apiBaseUrl;
    this.userAgent = userAgents[getRandomNumber(0, userAgents.length - 1)];
    this.proxyAgent =
      config.useProxy && this.proxyUrl
        ? new HttpsProxyAgent(this.proxyUrl)
        : null;

    this.lastClaimWasAlreadyCollected = false;
    this.lastClaimWasAvailable = false;

    this.log = this.log.bind(this);
    this._makeRequest = this._makeRequest.bind(this);
    this.authSayEcho = this.authSayEcho.bind(this);
    this.getMeInfo = this.getMeInfo.bind(this);
    this.fetchQuests = this.fetchQuests.bind(this);
    this._visitPostWithBrowser = this._visitPostWithBrowser.bind(this);
    this.completeCheckOutPostQuest = this.completeCheckOutPostQuest.bind(this);
    this.claimSayEchoDailyWaves = this.claimSayEchoDailyWaves.bind(this);
  }

  log(message, type = "info") {
    utilLogFromUtils(message, type, this.accountIdentifier);
  }

  async _makeRequest(url, method, data = null, extraHeaders = {}) {
    // ... (Content of _makeRequest method is THE SAME as the last full version I provided)
    // This method already correctly handles tokens, retries, 401, 409, 429 etc.
    if (!this.sayechoToken) {
      this.log("Aborting request: SayEcho token is missing.");
      return {
        success: false,
        status: "TOKEN_ERROR",
        error: "SayEcho token not provided to client",
      };
    }
    const commonHeaders = {
      Authorization: `Bearer ${this.sayechoToken}`,
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.sayecho.xyz",
      Referer: "https://www.sayecho.xyz/",
      "User-Agent": this.userAgent,
    };
    const headers = { ...commonHeaders, ...extraHeaders };

    if (method.toLowerCase() === "post" || method.toLowerCase() === "put") {
      if (data !== null) {
        headers["Content-Type"] = "application/json";
      }
    }

    let retries = 2;
    for (let i = 0; i <= retries; i++) {
      try {
        const axiosConfig = { method, url, headers, timeout: 30000 };
        if (this.proxyAgent) {
          axiosConfig.httpsAgent = this.proxyAgent;
          axiosConfig.httpAgent = this.proxyAgent;
        }
        if (method.toLowerCase() !== "get" && method.toLowerCase() !== "head") {
          axiosConfig.data = data;
        }

        const response = await axios(axiosConfig);
        return { success: true, status: response.status, data: response.data };
      } catch (error) {
        const status = error.response
          ? error.response.status
          : error.code || "NETWORK_ERROR";
        let errorDetail = "Unknown error";
        if (error.response) {
          if (typeof error.response.data === "string")
            errorDetail = error.response.data;
          else if (
            typeof error.response.data === "object" &&
            error.response.data !== null
          )
            errorDetail =
              error.response.data.message ||
              error.response.data.error ||
              error.response.data;
          else errorDetail = error.message;
        } else {
          errorDetail = error.message;
        }

        this.log(
          `Request to ${url} failed. Attempt ${i + 1}/${
            retries + 1
          }. Status: ${status}, Error: ${JSON.stringify(errorDetail)}`,
          "warning"
        );

        if (status === 401) {
          this.log(
            "SayEcho Token is invalid or expired. Attempting re-authentication...",
            "error"
          );
          const authSuccessful = await this.authSayEcho(true);
          if (authSuccessful) {
            headers["Authorization"] = `Bearer ${this.sayechoToken}`;
            this.log(
              "Re-authenticated (or token deemed usable). Retrying original request...",
              "info"
            );
          } else {
            this.log("Re-authentication failed. Cannot proceed.", "error");
            return {
              success: false,
              status,
              error: "Re-authentication failed",
            };
          }
        } else if (status === 409) {
          this.log(`Conflict error for ${url}. No further retries.`, "warning");
          return {
            success: false,
            status,
            error: errorDetail,
            data: error.response?.data,
          };
        } else if (status === 429) {
          this.log(`Rate limit for ${url}. Waiting 60s.`, "warning");
          await sleep(60);
        }

        if (i === retries) {
          return {
            success: false,
            status,
            error: errorDetail,
            data: error.response ? error.response.data : null,
          };
        }
        if (status !== 401) {
          await sleep(getRandomNumber(5, 10));
        }
      }
    }
    return {
      success: false,
      status: "UNKNOWN_ERROR",
      error: "Max retries loop issue",
    };
  }

  async authSayEcho(forceRefresh = false) {
    // ... (Content of authSayEcho method is THE SAME - CRITICAL PLACEHOLDER)
    this.log("Checking SayEcho authentication...");
    if (!this.sayechoToken) {
      this.log("No SayEcho token available. Authentication cannot proceed.");
      this.log(
        "CRITICAL: Implement SayEcho Authentication (token fetching).",
        "error"
      );
      return false;
    }
    const { isExpired, expirationDate } = isSayEchoTokenExpired(
      this.sayechoToken
    );
    this.log(
      `Current SayEcho token - Expires: ${expirationDate}, IsExpired: ${isExpired}`
    );

    if (!isExpired && !forceRefresh) {
      this.log("Using existing valid SayEcho token.", "success");
      return true;
    }

    this.log(
      "SayEcho Authentication flow needs to run (token expired or refresh forced).",
      "warning"
    );
    this.log(
      "CRITICAL: SayEcho Authentication (token fetching/refreshing) NOT IMPLEMENTED.",
      "error"
    );
    if (isExpired) {
      this.log(
        "Static SayEcho token is expired. Bot cannot re-authenticate.",
        "error"
      );
      return false;
    }
    return true;
  }

  async getMeInfo() {
    // ... (Content of getMeInfo method is THE SAME)
    this.log("Fetching /me info...");
    const response = await this._makeRequest(
      `${this.sayechoBaseURL}/me`,
      "get"
    );
    if (response.success && response.data) {
      this.log(
        `User: ${response.data.username}, Score: ${response.data.score}, Addr: ${response.data.address}`,
        "success"
      );
      return response.data;
    }
    this.log(
      `Failed to fetch /me info. Resp: ${JSON.stringify(response)}`,
      "error"
    );
    return null;
  }

  async fetchQuests() {
    // ... (Content of fetchQuests method is THE SAME)
    this.log("Fetching quests...");
    const response = await this._makeRequest(
      `${this.sayechoBaseURL}/quests`,
      "get"
    );
    if (response.success && Array.isArray(response.data)) {
      this.log(`Fetched ${response.data.length} quests.`);
      return response.data;
    }
    this.log(
      `Failed to fetch quests. Resp: ${JSON.stringify(response)}`,
      "warning"
    );
    return null;
  }

  async _visitPostWithBrowser(postUrl) {
    // ... (Content of _visitPostWithBrowser method is THE SAME)
    if (!config.visitExternalLinks) {
      this.log(`Skipping browser visit for ${postUrl} (config).`);
      return true;
    }
    this.log(`Visiting (Puppeteer): ${postUrl}`);
    let browser;
    try {
      const puppeteerArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
      if (config.useProxy && this.proxyUrl) {
        puppeteerArgs.push(
          `--proxy-server=${this.proxyUrl.replace(/^http(s)?:\/\//, "")}`
        );
      }
      browser = await puppeteer.launch({
        headless: config.puppeteerHeadless,
        args: puppeteerArgs,
      });
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);

      await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(
        getRandomNumber(config.delayAfterVisit[0], config.delayAfterVisit[1])
      );
      await browser.close();
      this.log(`Successfully "visited" ${postUrl}`, "success");
      return true;
    } catch (error) {
      this.log(
        `Error visiting ${postUrl} with browser: ${error.message}`,
        "error"
      );
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          this.log(`Err closing browser: ${e.message}`, "error");
        }
      }
      return false;
    }
  }

  async completeCheckOutPostQuest(quest) {
    // ... (Content of completeCheckOutPostQuest method is THE SAME)
    if (
      !quest ||
      quest.type !== "CHECK_OUT_POST" ||
      !quest.id ||
      !quest.metadata?.post
    ) {
      this.log("Invalid CHECK_OUT_POST quest data.", "error");
      return false;
    }
    this.log(`Completing CHECK_OUT_POST quest ID: ${quest.id}`);

    if (config.visitExternalLinks) {
      await this._visitPostWithBrowser(quest.metadata.post);
      await sleep(getRandomNumber(1, 2));
    }

    const completeUrl = `${this.sayechoBaseURL}/quests/${quest.id}`;
    const response = await this._makeRequest(completeUrl, "post", null);

    if (response.success && response.status === 200 && response.data) {
      if (response.data.id && response.data.metadata?.questId === quest.id) {
        this.log(
          `Quest ${quest.id} completed! Score: ${
            response.data.score !== undefined ? response.data.score : "N/A"
          }.`,
          "success"
        );
        return true;
      } else {
        this.log(
          `Quest ${
            quest.id
          } POST OK, but resp data unexpected: ${JSON.stringify(
            response.data
          )}`,
          "warning"
        );
        return true;
      }
    }

    if (!response.success && response.status === 409) {
      this.log(
        `Quest ${quest.id} already completed/conflict. Server: ${JSON.stringify(
          response.error
        )}`,
        "warning"
      );
    } else if (!response.success) {
      this.log(
        `Failed to complete quest ${quest.id}. Resp: ${JSON.stringify(
          response
        )}`,
        "error"
      );
    }
    return false;
  }

  async claimSayEchoDailyWaves() {
    // ... (Content of claimSayEchoDailyWaves method is THE SAME)
    this.lastClaimWasAlreadyCollected = false;
    this.lastClaimWasAvailable = false;

    this.log("Attempting to claim daily waves (POST)...");
    const url = `${this.sayechoBaseURL}/daily-waves`;
    const response = await this._makeRequest(url, "post", null);

    if (response.success && response.data) {
      if (
        response.data.didCollect === true &&
        response.data.score !== undefined
      ) {
        this.log(
          `Daily waves claimed! Collected: ${
            response.data.score
          }. Next: ${new Date(response.data.nextReset).toLocaleString()}.`,
          "success"
        );
        this.lastClaimWasAlreadyCollected = true;
        return true;
      } else if (response.data.didCollect === false) {
        this.log(
          `POST returned didCollect:false. Waves available or claim failed. Next: ${new Date(
            response.data.nextReset
          ).toLocaleString()}.`,
          "warning"
        );
        this.lastClaimWasAvailable = true;
        return false;
      } else {
        this.log(
          `Daily waves POST resp unexpected (success true): ${JSON.stringify(
            response.data
          )}`,
          "warning"
        );
        if (response.data.didCollect === true) {
          this.lastClaimWasAlreadyCollected = true;
          this.log(
            `Daily waves likely already collected (POST success, no score). Next: ${
              response.data.nextReset
                ? new Date(response.data.nextReset).toLocaleString()
                : "N/A"
            }.`,
            "warning"
          );
        }
        return false;
      }
    } else if (!response.success && response.status === 409) {
      const serverMessage = JSON.stringify(response.error || response.data);
      const nextReset = response.data?.nextReset
        ? new Date(response.data.nextReset).toLocaleString()
        : "N/A";
      this.log(
        `Daily waves already collected (409). Server: ${serverMessage}. Next: ${nextReset}`,
        "warning"
      );
      this.lastClaimWasAlreadyCollected = true;
      return false;
    }

    this.log(
      `Failed to claim daily waves (POST). Resp: ${JSON.stringify(response)}`,
      "error"
    );
    return false;
  }
}

module.exports = { SayEchoClientAPI };
