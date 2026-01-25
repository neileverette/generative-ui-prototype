/**
 * Claude Console Usage Scraper
 * Runs headlessly using saved session, extracts usage data
 *
 * Usage: npx ts-node server/claude-scraper/scrape.ts
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
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var USER_DATA_DIR = path.join(__dirname, '.session');
var OUTPUT_FILE = path.join(__dirname, 'usage-data.json');
function scrape() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, page, data, usageData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check if session exists
                    if (!fs.existsSync(USER_DATA_DIR)) {
                        throw new Error('No session found. Run login.ts first.');
                    }
                    console.log('[Scraper] Starting headless browser...');
                    return [4 /*yield*/, chromium.launchPersistentContext(USER_DATA_DIR, {
                            headless: true,
                            viewport: { width: 1280, height: 800 },
                        })];
                case 1:
                    browser = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 7, 9]);
                    return [4 /*yield*/, browser.newPage()];
                case 3:
                    page = _a.sent();
                    console.log('[Scraper] Navigating to usage page...');
                    return [4 /*yield*/, page.goto('https://console.anthropic.com/settings/usage', {
                            waitUntil: 'networkidle',
                            timeout: 30000,
                        })];
                case 4:
                    _a.sent();
                    // Wait for the usage data to load
                    return [4 /*yield*/, page.waitForSelector('text=Current session', { timeout: 10000 })];
                case 5:
                    // Wait for the usage data to load
                    _a.sent();
                    console.log('[Scraper] Extracting usage data...');
                    return [4 /*yield*/, page.evaluate(function () {
                            var getText = function (selector) {
                                var _a;
                                var el = document.querySelector(selector);
                                return ((_a = el === null || el === void 0 ? void 0 : el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                            };
                            // Find all sections by looking for headers
                            var sections = document.querySelectorAll('div');
                            var currentSession = { resetsIn: '', percentageUsed: 0 };
                            var allModels = { resetsIn: '', percentageUsed: 0 };
                            var sonnetOnly = { resetsIn: '', percentageUsed: 0 };
                            sections.forEach(function (section) {
                                var text = section.textContent || '';
                                // Current session section
                                if (text.includes('Current session') && text.includes('Resets in')) {
                                    var resetsMatch = text.match(/Resets in ([^%]+?)(?=\d+%)/);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        currentSession.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        currentSession.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                                // Weekly - All models
                                if (text.includes('All models') && text.includes('Resets')) {
                                    var resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        allModels.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        allModels.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                                // Weekly - Sonnet only
                                if (text.includes('Sonnet only') && text.includes('Resets')) {
                                    var resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        sonnetOnly.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        sonnetOnly.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                            });
                            return { currentSession: currentSession, allModels: allModels, sonnetOnly: sonnetOnly };
                        })];
                case 6:
                    data = _a.sent();
                    usageData = {
                        currentSession: data.currentSession,
                        weeklyLimits: {
                            allModels: data.allModels,
                            sonnetOnly: data.sonnetOnly,
                        },
                        lastUpdated: new Date().toISOString(),
                    };
                    console.log('[Scraper] Data extracted:', JSON.stringify(usageData, null, 2));
                    // Save to file
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
                    console.log('[Scraper] Saved to:', OUTPUT_FILE);
                    return [2 /*return*/, usageData];
                case 7: return [4 /*yield*/, browser.close()];
                case 8:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Run if called directly
if (require.main === module) {
    scrape()
        .then(function () {
        console.log('[Scraper] Done!');
        process.exit(0);
    })
        .catch(function (err) {
        console.error('[Scraper] Error:', err.message);
        process.exit(1);
    });
}
export { scrape };
