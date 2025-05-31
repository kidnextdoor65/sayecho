// sayecho-bot/utils.js
const colors = require("colors");
const { jwtDecode } = require("jwt-decode");

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function getRandomNumber(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function log(message, type = "info", accountIdentifier = "Global") {
  const timestamp = new Date().toLocaleTimeString();
  const idPart =
    typeof accountIdentifier === "number"
      ? `[${accountIdentifier}]`
      : `[${accountIdentifier}]`;
  const prefix = `[${timestamp}][SayEchoBot]${idPart}`;
  switch (type) {
    case "success":
      console.log(`${prefix} ${message}`.green);
      break;
    case "error":
      console.log(`${prefix} ${message}`.red);
      break;
    case "warning":
      console.log(`${prefix} ${message}`.yellow);
      break;
    case "custom":
      console.log(`${prefix} ${message}`.magenta);
      break;
    default:
      console.log(`${prefix} ${message}`.blue);
  }
}

function isSayEchoTokenExpired(token) {
  if (!token)
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
  try {
    const payload = jwtDecode(token);
    if (!payload || typeof payload.exp === "undefined") {
      log(
        "Token does not contain an expiration (exp) claim. Assuming it needs manual check/refresh.",
        "warning",
        "TokenUtil"
      );
      return { isExpired: false, expirationDate: "No Expiry Claim" };
    }
    const now = Math.floor(Date.now() / 1000);
    const expirationDate = new Date(payload.exp * 1000).toLocaleString();
    const isExpired = now > payload.exp;
    return { isExpired, expirationDate };
  } catch (error) {
    log(
      `Error decoding SayEcho token: ${error.message}. Treating as expired.`,
      "error",
      "TokenUtil"
    );
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
  }
}

module.exports = {
  sleep,
  getRandomNumber,
  log,
  isSayEchoTokenExpired,
};
