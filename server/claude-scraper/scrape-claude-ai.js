/**
 * Scrape claude.ai/settings/usage
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var OUTPUT_FILE = path.join(__dirname, 'usage-data.json');
// Chrome cookies location
var CHROME_PROFILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default');
function scrape() {
    return __awaiter(this, void 0, void 0, function () {
        var userDataDir, browser, page, text, data, usageData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[Scraper] Launching Chrome...');
                    userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
                    return [4 /*yield*/, chromium.launchPersistentContext(userDataDir, {
                            headless: false,
                            channel: 'chrome',
                            args: ['--profile-directory=Default'],
                        })];
                case 1:
                    browser = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 8, 10]);
                    return [4 /*yield*/, browser.newPage()];
                case 3:
                    page = _a.sent();
                    console.log('[Scraper] Navigating to claude.ai/settings/usage...');
                    return [4 /*yield*/, page.goto('https://claude.ai/settings/usage', {
                            waitUntil: 'networkidle',
                            timeout: 30000,
                        })];
                case 4:
                    _a.sent();
                    // Wait for content
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 5:
                    // Wait for content
                    _a.sent();
                    console.log('[Scraper] Extracting data...');
                    return [4 /*yield*/, page.evaluate(function () { return document.body.innerText; })];
                case 6:
                    text = _a.sent();
                    console.log('[Scraper] Page text:', text.substring(0, 500));
                    return [4 /*yield*/, page.evaluate(function () {
                            var text = document.body.innerText;
                            // Current session
                            var sessionResetMatch = text.match(/Resets in (\d+ hr \d+ min|\d+ min)/i);
                            var sessionPercentMatch = text.match(/(\d+)%\s*used/i);
                            // Look for weekly data
                            var allModelsMatch = text.match(/All models[\s\S]*?Resets ([^\n]+?)(\d+)%/i);
                            var sonnetMatch = text.match(/Sonnet only[\s\S]*?Resets ([^\n]+?)(\d+)%/i);
                            return {
                                currentSession: {
                                    resetsIn: sessionResetMatch ? sessionResetMatch[1] : '',
                                    percentageUsed: sessionPercentMatch ? parseInt(sessionPercentMatch[1], 10) : 0,
                                },
                                weeklyLimits: {
                                    allModels: {
                                        resetsIn: allModelsMatch ? allModelsMatch[1].trim() : '',
                                        percentageUsed: allModelsMatch ? parseInt(allModelsMatch[2], 10) : 0,
                                    },
                                    sonnetOnly: {
                                        resetsIn: sonnetMatch ? sonnetMatch[1].trim() : '',
                                        percentageUsed: sonnetMatch ? parseInt(sonnetMatch[2], 10) : 0,
                                    },
                                },
                                rawText: text.substring(0, 1000),
                            };
                        })];
                case 7:
                    data = _a.sent();
                    console.log('[Scraper] Extracted:', JSON.stringify(data, null, 2));
                    usageData = {
                        currentSession: data.currentSession,
                        weeklyLimits: data.weeklyLimits,
                        lastUpdated: new Date().toISOString(),
                    };
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
                    console.log('[Scraper] Saved to:', OUTPUT_FILE);
                    return [2 /*return*/, usageData];
                case 8: return [4 /*yield*/, browser.close()];
                case 9:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
scrape()
    .then(function () {
    console.log('[Scraper] Done!');
    process.exit(0);
})
    .catch(function (err) {
    console.error('[Scraper] Error:', err);
    process.exit(1);
});
