import dotenv from "dotenv";
dotenv.config();

import algosdk, { waitForConfirmation } from "algosdk";
import arc200 from "arc200js";

function createAccount() {
  const account = algosdk.generateAccount();
  const addr = account.addr;
  const passphrase = algosdk.secretKeyToMnemonic(account.sk);
  return { addr, passphrase };
}

function accountFromPassphrase(passphrase) {
  const sk = algosdk.mnemonicToSecretKey(passphrase).sk;
  const addr = algosdk.mnemonicToSecretKey(passphrase).addr;
  return { addr, sk };
}

async function sendVoi(senderAccount, receiverAddress, amount) {
  try {
    // Get the parameters for the transaction
    const params = await algodClient.getTransactionParams().do();

    // Create the transaction
    const txn = {
      from: senderAccount.addr,
      to: receiverAddress,
      amount: algosdk.algosToMicroalgos(amount), // Convert ALGO to microALGO
      suggestedParams: params,
    };

    // Sign the transaction
    const signedTxn = algosdk.signTransaction(txn, senderAccount.sk);

    // Submit the transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxn.blob).do();

    await waitForConfirmation(algodClient, txId, 4);

    console.log(`Sent ${amount} VOI to ${receiverAddress}`);
  } catch (error) {
    console.error("Error sending VOI:", error);
  }
}

async function getVoiBalance(algodClient, address) {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    return accountInfo.amount; // The balance is in microalgos
  } catch (e) {
    console.error("Error fetching VOI balance:", e);
    return null;
  }
}

// Recover the Funder Account
const funderAccount = algosdk.mnemonicToSecretKey(
  process.env.VOI_WALLET_MNEMONIC
);

// Create three accounts
const tipBotAccount = createAccount();
const tipperAccount = createAccount();
const receiverAccount = createAccount();

console.log("Funder Account Address:", funderAccount.addr);
console.log("Tip Bot Account:", tipBotAccount);
console.log("Tipper Account:", tipperAccount);
console.log("Receiver Account:", receiverAccount);

console.log("Funder Account:", funderAccount);

const algodToken = ""; // Your Algod API token
const algodServer = process.env.VOI_ALGOD_URL; // Address of your Algod node
const algodPort = ""; // Port of your Algod node

const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

const tokenId = 6792305;
// const tokenId = 6778021; // VRC200

const ci = new arc200(tokenId, algodClient);
const optsTemplate = {
  acc: {},
  simulate: true,
  waitForConfirmation: true,
  formatBytes: true,
};
let optsFunder = {
  ...optsTemplate,
  acc: funderAccount,
};
const ciFunder = new arc200(tokenId, algodClient, optsFunder);
let optsTipper = {
  ...optsTemplate,
  acc: accountFromPassphrase(tipperAccount.passphrase),
};
const ciTipper = new arc200(tokenId, algodClient, optsTipper);
let optsTipBot = {
  ...optsTemplate,
  acc: accountFromPassphrase(tipBotAccount.passphrase),
};
const ciTipBot = new arc200(tokenId, algodClient, optsTipBot);

console.log(await ci.getMetadata());

// Fund Accounts with Tokens
// Wait for confirmation
let res = await ciFunder.arc200_transfer(tipperAccount.addr, 100, false, true);
console.log({ res });

// Fund Native Token to Tipper and TipBot
await sendVoi(funderAccount, tipperAccount.addr, 0.14);
await sendVoi(funderAccount, tipBotAccount.addr, 0.2);

// Retrieve balances
let funderAccountBalance = await ci.arc200_balanceOf(funderAccount.addr);
let tipBotAccountBalance = await ci.arc200_balanceOf(tipBotAccount.addr);
let tipperAccountBalance = await ci.arc200_balanceOf(tipperAccount.addr);
let receiverAccountBalance = await ci.arc200_balanceOf(receiverAccount.addr);

// Log balances
console.log("Balance of Funder Bot Account:", funderAccountBalance.returnValue);
console.log("Balance of Tip Bot Account:", tipBotAccountBalance.returnValue);
console.log("Balance of Tipper Account:", tipperAccountBalance.returnValue);
await getVoiBalance(algodClient, tipperAccount.addr).then((balance) => {
  console.log("VOI Balance (tipper):", balance / 1e6, "VOI");
});
await getVoiBalance(algodClient, tipBotAccount.addr).then((balance) => {
  console.log("VOI Balance (tipBot):", balance / 1e6, "VOI");
});

console.log("Balance of Receiver Account:", receiverAccountBalance.returnValue);

// // Allow Tip Bot to Spend a Set Amount
console.log("Allowing Tip Bot to Tip");

const res4 = await ciTipper.arc200_approve(
  tipBotAccount.addr,
  100,
  false,
  true
);
console.log({ res4 });

console.log("[allowance]");

// // TODO: Tip Bot Sends 1/2 Set amount twice
const all = await ciTipBot.arc200_allowance(
  tipperAccount.addr,
  tipBotAccount.addr
);

console.log("Tipbot Allowance from Tipper", all.returnValue);

console.log("[transferFrom]");

await ciTipBot.arc200_transferFrom(
  tipperAccount.addr,
  receiverAccount.addr,
  50,
  false,
  true
);
await ciTipBot.arc200_transferFrom(
  tipperAccount.addr,
  receiverAccount.addr,
  50,
  false,
  true
);

process.exit(0);

console.log(
  "Balance of Funder Bot Account: ",
  await ci.arc200_balanceOf(funderAccount.addr)
);
console.log(
  "Balance of Tipper Account: ",
  await ci.arc200_balanceOf(tipperAccount.addr)
);
console.log(
  "Balance of Tip Bot Account: ",
  await ci.arc200_balanceOf(tipBotAccount.addr)
);
console.log(
  "Balance of Receiver Account: ",
  await ci.arc200_balanceOf(receiverAccount.addr)
);

// TODO: Display Balances