// sayecho-bot/main.js
const fs = require("fs");
const path = require("path");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const config = require("./config"); // Path to config.js in the same directory
const { sleep, getRandomNumber, log: utilLogGlobal } = require("./utils"); // Path to utils.js
// const { showBanner } = require('./banner'); // Banner was removed

function loadAccountsData() {
  const tokensFilePath = path.join(__dirname, "token.txt"); // Assumes token.txt is in the root
  const proxiesFilePath = path.join(__dirname, "proxy.txt"); // Assumes proxy.txt is in the root
  let tokens = [];
  let proxies = [];

  try {
    tokens = fs
      .readFileSync(tokensFilePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && line.startsWith("eyJhbGciOiJI"));
    if (tokens.length === 0) {
      utilLogGlobal(
        "No valid tokens found in token.txt.",
        "warning",
        "AccountLoader"
      );
    }
  } catch (error) {
    utilLogGlobal(
      `Error reading tokens from token.txt: ${error.message}. This file is required.`,
      "error",
      "AccountLoader"
    );
    return [];
  }

  if (config.useProxy) {
    try {
      proxies = fs
        .readFileSync(proxiesFilePath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (proxies.length === 0 && !config.globalProxyUrl) {
        utilLogGlobal(
          "config.useProxy is true, but no proxies in proxy.txt and no globalProxyUrl.",
          "warning",
          "ProxyLoader"
        );
      } else if (proxies.length > 0) {
        utilLogGlobal(
          `Loaded ${proxies.length} proxies from proxy.txt.`,
          "info",
          "ProxyLoader"
        );
      }
    } catch (error) {
      utilLogGlobal(
        `Error reading proxies from proxy.txt: ${error.message}. Will use global or no proxy.`,
        "warning",
        "ProxyLoader"
      );
    }
  }

  return tokens.map((token, index) => {
    let proxyForThisAccount = null;
    if (config.useProxy) {
      if (proxies.length > 0) {
        proxyForThisAccount = proxies[index % proxies.length];
      } else if (config.globalProxyUrl) {
        proxyForThisAccount = config.globalProxyUrl;
      }
    }
    return {
      bearerToken: token,
      proxyUrl: proxyForThisAccount,
      originalIndex: index,
    };
  });
}

async function runSingleAccountWorkerLogic(workerThreadData) {
  const { SayEchoClientAPI } = require("./sayecho_client"); // Path to sayecho_client.js in the same directory
  const { accountConfig, accountIndex } = workerThreadData;

  const client = new SayEchoClientAPI(
    accountIndex,
    accountConfig.bearerToken,
    accountConfig.proxyUrl
  );

  try {
    client.log(`Worker starting tasks...`);

    const isAuthenticated = await client.authSayEcho();
    if (!isAuthenticated) {
      client.log("Authentication failed. Stopping tasks.");
      return;
    }
    await sleep(
      getRandomNumber(
        config.delayBetweenActions[0],
        config.delayBetweenActions[1]
      )
    );

    let initialScore = null;
    if (config.performMeCheck) {
      const initialMeInfo = await client.getMeInfo();
      if (initialMeInfo) initialScore = initialMeInfo.score;
      await sleep(
        getRandomNumber(
          config.delayBetweenActions[0],
          config.delayBetweenActions[1]
        )
      );
    }

    if (config.fetchQuests) {
      const quests = await client.fetchQuests();
      if (quests) {
        for (const quest of quests) {
          if (
            quest.type === "CHECK_OUT_POST" &&
            quest.isActive &&
            config.completeCheckOutPosts
          ) {
            await client.completeCheckOutPostQuest(quest);
            await sleep(
              getRandomNumber(
                config.delayBetweenActions[0],
                config.delayBetweenActions[1]
              )
            );
          }
        }
      }
      await sleep(
        getRandomNumber(
          config.delayBetweenActions[0],
          config.delayBetweenActions[1]
        )
      );
    }

    if (config.claimDailyWaves) {
      const claimSuccess = await client.claimSayEchoDailyWaves();
      if (
        config.performMeCheck &&
        initialScore !== null &&
        (claimSuccess || client.lastClaimWasAlreadyCollected)
      ) {
        await sleep(getRandomNumber(2, 4));
        client.log(
          "Re-checking /me for score update after daily waves attempt..."
        );
        const userInfoAfterClaim = await client.getMeInfo();
        if (userInfoAfterClaim) {
          client.log(
            `Score after daily waves: ${userInfoAfterClaim.score}. Initial: ${initialScore}`
          );
          if (userInfoAfterClaim.score > initialScore) {
            client.log(
              `Score increased by ${userInfoAfterClaim.score - initialScore}!`,
              "success"
            );
          }
        }
      }
    }
    client.log(`All configured tasks finished.`);
  } catch (error) {
    const logFn = client ? client.log : utilLogGlobal;
    const idForLog = client ? client.accountIdentifier : accountIndex + 1;
    logFn(
      `Unhandled error in worker for account ${idForLog}: ${error.message}`,
      "error"
    );
    console.error(error.stack);
    if (parentPort)
      parentPort.postMessage({
        type: "error",
        accountLogId: idForLog,
        message: error.message,
      });
    else throw error;
  }
}

if (isMainThread) {
  async function startMainProcess() {
    // showBanner(); // Banner is removed
    utilLogGlobal("SayEcho Bot - Main Process Started", "custom");
    utilLogGlobal(
      "Reminder: Implement actual SayEcho authentication flow!",
      "warning"
    );
    utilLogGlobal(
      "Ensure tokens in token.txt & proxies (if used) in proxy.txt",
      "info"
    );
    utilLogGlobal(
      "------------------------------------------------------",
      "info"
    );

    const accounts = loadAccountsData();
    if (accounts.length === 0) {
      utilLogGlobal("No accounts loaded. Exiting.", "error");
      return;
    }
    utilLogGlobal(
      `Loaded ${accounts.length} accounts. Max parallel threads: ${config.maxThreads}`,
      "info"
    );

    while (true) {
      utilLogGlobal(
        `Starting new cycle for ${accounts.length} accounts.`,
        "custom",
        "GlobalCycle"
      );

      const accountQueue = [...accounts];
      const activeWorkers = new Set();
      let processedInCycleCount = 0;
      let taskPointer = 0;

      await new Promise((cycleResolve) => {
        let resolveCalled = false;
        function tryResolveCycle() {
          if (
            processedInCycleCount >= accounts.length &&
            activeWorkers.size === 0 &&
            !resolveCalled
          ) {
            resolveCalled = true;
            cycleResolve();
          }
        }

        function launchNextWorker() {
          if (
            (taskPointer >= accountQueue.length && activeWorkers.size === 0) ||
            (processedInCycleCount >= accountQueue.length &&
              activeWorkers.size === 0)
          ) {
            if (!resolveCalled) {
              resolveCalled = true;
              cycleResolve();
            }
            return;
          }
          if (
            taskPointer < accountQueue.length &&
            activeWorkers.size < config.maxThreads
          ) {
            const accountDataForWorker = accountQueue[taskPointer];

            utilLogGlobal(
              `Launching worker for account #${
                accountDataForWorker.originalIndex + 1
              }... Active: ${activeWorkers.size}, Queued: ${
                accountQueue.length - (taskPointer + 1)
              }`,
              "info",
              "GlobalCycle"
            );

            const worker = new Worker(__filename, {
              workerData: {
                accountConfig: accountDataForWorker,
                accountIndex: accountDataForWorker.originalIndex,
              },
            });
            activeWorkers.add(worker);
            taskPointer++;

            worker.on("message", (msg) => {});
            worker.on("error", (err) => {
              utilLogGlobal(
                `Worker for account #${
                  accountDataForWorker.originalIndex + 1
                } ERRORED: ${err.message}`,
                "error",
                "GlobalCycle"
              );
              activeWorkers.delete(worker);
              processedInCycleCount++;
              launchNextWorker();
            });
            worker.on("exit", (code) => {
              activeWorkers.delete(worker);
              processedInCycleCount++;
              if (code !== 0) {
                utilLogGlobal(
                  `Worker for account #${
                    accountDataForWorker.originalIndex + 1
                  } exited with code ${code}`,
                  "warning",
                  "GlobalCycle"
                );
              }
              launchNextWorker();
            });
          }
        }

        for (let i = 0; i < config.maxThreads; i++) {
          launchNextWorker();
        }
        if (
          taskPointer >= accountQueue.length &&
          activeWorkers.size === 0 &&
          !resolveCalled
        ) {
          resolveCalled = true;
          cycleResolve();
        }
        if (accounts.length === 0 && !resolveCalled) {
          resolveCalled = true;
          cycleResolve();
        }
      });

      utilLogGlobal(
        `All ${accounts.length} SayEcho accounts processed for this cycle.`,
        "custom",
        "GlobalCycle"
      );
      const cycleSleepSeconds = (config.timeSleepMinutesAtCycleEnd || 60) * 60;
      utilLogGlobal(
        `Sleeping for ${
          config.timeSleepMinutesAtCycleEnd || 60
        } minutes before next cycle...`,
        "info",
        "GlobalCycle"
      );
      await sleep(cycleSleepSeconds);
    }
  }

  startMainProcess().catch((error) => {
    console.error("Unhandled critical error in Main Process:".red, error);
    process.exit(1);
  });
} else {
  // This code runs in the worker thread
  const { SayEchoClientAPI } = require("./sayecho_client"); // Path relative to main.js for worker
  runSingleAccountWorkerLogic(workerData)
    .then(() => {
      if (parentPort)
        parentPort.postMessage({
          type: "done",
          accountIndex: workerData.accountIndex,
        });
      process.exit(0);
    })
    .catch((err) => {
      if (parentPort)
        parentPort.postMessage({
          type: "error",
          accountIndex: workerData.accountIndex,
          message: err.message,
        });
      process.exit(1);
    });
}
