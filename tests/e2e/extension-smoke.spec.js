const { test, expect } = require("@playwright/test");
const path = require("path");

test("loads extension popup assets in built Chrome output", async ({ page }) => {
  const popupPath = path.resolve(__dirname, "../../dist/chrome/popup/popup.html");
  await page.goto(`file://${popupPath}`);
  await expect(page.locator("#root")).toBeVisible();
});
