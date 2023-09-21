// @ts-check
import assert from "node:assert";
import { randomFillSync, randomInt } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import dotenv from "dotenv";
import { cleanEnv, str, url } from "envalid";
import { launch } from "puppeteer";

import data from "./data.json" assert { type: "json" };

dotenv.config();
const { VOTING_SITE_URL, TARGET_NAME } = cleanEnv(process.env, {
  VOTING_SITE_URL: url(),
  TARGET_NAME: str(),
});

const browser = await launch({
  headless: "new",
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

let result;

try {
  const page = await browser.newPage();
  const userAgent = data.userAgents[randomInt(0, data.userAgents.length)].value;
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ru-RU",
  });
  await page.goto(VOTING_SITE_URL);

  const CONTAINER_CLASS_NAME = "contestants-list";
  const CARD_ITEMTYPE = "http://schema.org/ImageObject";

  const { cardsCount, targetCardIndex } = await page.$$eval(
    `.${CONTAINER_CLASS_NAME} [itemtype='${CARD_ITEMTYPE}']`,
    (cards, targetName) => ({
      cardsCount: cards.length,
      targetCardIndex: cards.findIndex((item) => {
        return item
          .querySelector("[itemprop='name']")
          ?.textContent?.includes(targetName);
      }),
    }),
    TARGET_NAME
  );
  assert(cardsCount !== 0);
  assert(targetCardIndex !== -1);

  let randomData;

  for (;;) {
    randomData = randomFillSync(new Uint8Array(2)).map(
      (item) => item % cardsCount
    );
    if (
      new Set([...randomData, targetCardIndex]).size ===
      randomData.length + 1
    ) {
      break;
    }
  }

  const allButtons = await page.$x(`
    //div[@class='${CONTAINER_CLASS_NAME}']
    //div[@itemtype='${CARD_ITEMTYPE}']
    //div[@class='vote']`);

  const targetButtons = [randomData[0], targetCardIndex, randomData[1]].map(
    (i) => allButtons[i]
  );

  for (const button of targetButtons) {
    // @ts-expect-error
    await button.click();
    await setTimeout(3000);
  }
  targetButtons.forEach((item) => item.dispose());

  const DIALOG_ID = "vote-choise-box";

  const dialogText = await page.$eval(
    `#${DIALOG_ID}`,
    ({ textContent }) => textContent
  );
  console.log("dialog text:");
  console.log(dialogText);
  assert(dialogText?.includes(TARGET_NAME));

  const [dialogSubmitButton] = await page.$x(`
    //div[@id='${DIALOG_ID}']
    //button`);
  // @ts-expect-error
  await dialogSubmitButton.click();
  await dialogSubmitButton.dispose();
  await setTimeout(3000);

  result = await page.$eval(`#${DIALOG_ID}`, ({ textContent }) => textContent);
} catch (e) {
  throw e;
} finally {
  await browser.close();
}

try {
  assert(result?.includes("Ваш голос учтен"));
} catch (e) {
  if (e?.code !== "ERR_ASSERTION") {
    throw e;
  }

  console.log("unable to vote");
  console.log(result);
  assert(result?.includes("С данного IP-адреса уже проголосовали"));
}
