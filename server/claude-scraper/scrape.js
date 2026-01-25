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
import { validateSession } from './session-validator.js';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var USER_DATA_DIR = path.join(__dirname, '.session');
var OUTPUT_FILE = path.join(__dirname, 'usage-data.json');
function scrape() {
    return __awaiter(this, void 0, void 0, function () {
        var validationResult, reason, isLikelyExpired, isNetworkIssue, isCorrupted, recoveryResult, recoveryAction, errorMessage, errorMessage, errorMessage, errorMessage, browser, page, extractionErrors, sectionsExtracted, totalSections, currentSession, extracted, err_1, errorMsg, allModels, extracted, err_2, errorMsg, sonnetOnly, extracted, err_3, errorMsg, usageData, missing;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // Validate session before scraping
                    console.log('[Scraper] Validating session...');
                    return [4 /*yield*/, validateSession()];
                case 1:
                    validationResult = _b.sent();
                    if (!!validationResult.valid) return [3 /*break*/, 4];
                    reason = validationResult.reason || 'Unknown error';
                    isLikelyExpired = reason.includes('Session expired') ||
                        reason.includes('login page') ||
                        reason.includes('Redirected to login');
                    isNetworkIssue = reason.includes('Navigation timeout') ||
                        reason.includes('network error');
                    isCorrupted = reason.includes('Session directory') ||
                        reason.includes('Failed to launch browser context');
                    if (!isLikelyExpired) return [3 /*break*/, 3];
                    console.log('[Scraper] Session appears expired. Attempting automatic recovery...');
                    return [4 /*yield*/, validateSession(true)];
                case 2:
                    recoveryResult = _b.sent();
                    if (recoveryResult.valid) {
                        console.log('[Scraper] Session recovered successfully! Continuing with scrape...');
                        // Fall through to continue scraping
                    }
                    else {
                        recoveryAction = (_a = recoveryResult.recoveryResult) === null || _a === void 0 ? void 0 : _a.action;
                        errorMessage = void 0;
                        if (recoveryAction === 'manual-login-required') {
                            errorMessage = 'SESSION_EXPIRED: Auto-recovery failed. Manual login required. Run: npx tsx server/claude-scraper/login.ts';
                        }
                        else if (recoveryAction === 'network-error') {
                            errorMessage = 'NETWORK_ERROR: Network timeout during recovery. Check connection and try again.';
                        }
                        else {
                            errorMessage = "SESSION_EXPIRED: ".concat(reason, ". Run: npx tsx server/claude-scraper/login.ts");
                        }
                        console.error("[Scraper] ".concat(errorMessage));
                        throw new Error(errorMessage);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    if (isNetworkIssue) {
                        errorMessage = 'NETWORK_ERROR: Network timeout accessing Console. Check connection and try again in 5 minutes.';
                        console.error("[Scraper] ".concat(errorMessage));
                        throw new Error(errorMessage);
                    }
                    else if (isCorrupted) {
                        errorMessage = 'CONTEXT_CORRUPTED: Browser session corrupted. Delete server/claude-scraper/.session/ and run: npx tsx server/claude-scraper/login.ts';
                        console.error("[Scraper] ".concat(errorMessage));
                        throw new Error(errorMessage);
                    }
                    else {
                        errorMessage = "UNKNOWN_ERROR: Session validation failed: ".concat(reason, ". Run: npx tsx server/claude-scraper/login.ts");
                        console.error("[Scraper] ".concat(errorMessage));
                        throw new Error(errorMessage);
                    }
                    _b.label = 4;
                case 4:
                    console.log('[Scraper] Session validated successfully');
                    console.log('[Scraper] Starting headless browser...');
                    return [4 /*yield*/, chromium.launchPersistentContext(USER_DATA_DIR, {
                            headless: true,
                            viewport: { width: 1280, height: 800 },
                        })];
                case 5:
                    browser = _b.sent();
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, , 25, 27]);
                    return [4 /*yield*/, browser.newPage()];
                case 7:
                    page = _b.sent();
                    console.log('[Scraper] Navigating to usage page...');
                    return [4 /*yield*/, page.goto('https://console.anthropic.com/settings/usage', {
                            waitUntil: 'networkidle',
                            timeout: 30000,
                        })];
                case 8:
                    _b.sent();
                    // Wait for the usage data to load
                    return [4 /*yield*/, page.waitForSelector('text=Current session', { timeout: 10000 })];
                case 9:
                    // Wait for the usage data to load
                    _b.sent();
                    console.log('[Scraper] Extracting usage data...');
                    extractionErrors = {};
                    sectionsExtracted = 0;
                    totalSections = 3;
                    currentSession = void 0;
                    _b.label = 10;
                case 10:
                    _b.trys.push([10, 13, , 14]);
                    return [4 /*yield*/, page.waitForSelector('text=Current session', { timeout: 5000 })];
                case 11:
                    _b.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var sections = document.querySelectorAll('div');
                            var result = { resetsIn: '', percentageUsed: 0 };
                            sections.forEach(function (section) {
                                var text = section.textContent || '';
                                if (text.includes('Current session') && text.includes('Resets in')) {
                                    var resetsMatch = text.match(/Resets in ([^%]+?)(?=\d+%)/);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        result.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        result.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                            });
                            return result.resetsIn ? result : null;
                        })];
                case 12:
                    extracted = _b.sent();
                    if (extracted) {
                        currentSession = extracted;
                    }
                    if (currentSession) {
                        sectionsExtracted++;
                        console.log('[Scraper] Current session extracted successfully');
                    }
                    else {
                        extractionErrors['currentSession'] = 'Data not found in DOM';
                        console.warn('[Scraper] Current session: Data not found');
                    }
                    return [3 /*break*/, 14];
                case 13:
                    err_1 = _b.sent();
                    errorMsg = err_1 instanceof Error ? err_1.message : String(err_1);
                    extractionErrors['currentSession'] = errorMsg;
                    console.warn('[Scraper] Current session extraction failed:', errorMsg);
                    return [3 /*break*/, 14];
                case 14:
                    allModels = void 0;
                    _b.label = 15;
                case 15:
                    _b.trys.push([15, 18, , 19]);
                    return [4 /*yield*/, page.waitForSelector('text=All models', { timeout: 5000 })];
                case 16:
                    _b.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var sections = document.querySelectorAll('div');
                            var result = { resetsIn: '', percentageUsed: 0 };
                            sections.forEach(function (section) {
                                var text = section.textContent || '';
                                if (text.includes('All models') && text.includes('Resets')) {
                                    var resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        result.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        result.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                            });
                            return result.resetsIn ? result : null;
                        })];
                case 17:
                    extracted = _b.sent();
                    if (extracted) {
                        allModels = extracted;
                    }
                    if (allModels) {
                        sectionsExtracted++;
                        console.log('[Scraper] Weekly all models extracted successfully');
                    }
                    else {
                        extractionErrors['allModels'] = 'Data not found in DOM';
                        console.warn('[Scraper] Weekly all models: Data not found');
                    }
                    return [3 /*break*/, 19];
                case 18:
                    err_2 = _b.sent();
                    errorMsg = err_2 instanceof Error ? err_2.message : String(err_2);
                    extractionErrors['allModels'] = errorMsg;
                    console.warn('[Scraper] Weekly all models extraction failed:', errorMsg);
                    return [3 /*break*/, 19];
                case 19:
                    sonnetOnly = void 0;
                    _b.label = 20;
                case 20:
                    _b.trys.push([20, 23, , 24]);
                    return [4 /*yield*/, page.waitForSelector('text=Sonnet only', { timeout: 5000 })];
                case 21:
                    _b.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var sections = document.querySelectorAll('div');
                            var result = { resetsIn: '', percentageUsed: 0 };
                            sections.forEach(function (section) {
                                var text = section.textContent || '';
                                if (text.includes('Sonnet only') && text.includes('Resets')) {
                                    var resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
                                    var percentMatch = text.match(/(\d+)%\s*used/);
                                    if (resetsMatch)
                                        result.resetsIn = resetsMatch[1].trim();
                                    if (percentMatch)
                                        result.percentageUsed = parseInt(percentMatch[1], 10);
                                }
                            });
                            return result.resetsIn ? result : null;
                        })];
                case 22:
                    extracted = _b.sent();
                    if (extracted) {
                        sonnetOnly = extracted;
                    }
                    if (sonnetOnly) {
                        sectionsExtracted++;
                        console.log('[Scraper] Weekly Sonnet only extracted successfully');
                    }
                    else {
                        extractionErrors['sonnetOnly'] = 'Data not found in DOM';
                        console.warn('[Scraper] Weekly Sonnet only: Data not found');
                    }
                    return [3 /*break*/, 24];
                case 23:
                    err_3 = _b.sent();
                    errorMsg = err_3 instanceof Error ? err_3.message : String(err_3);
                    extractionErrors['sonnetOnly'] = errorMsg;
                    console.warn('[Scraper] Weekly Sonnet only extraction failed:', errorMsg);
                    return [3 /*break*/, 24];
                case 24:
                    // Check if we got any data at all
                    if (sectionsExtracted === 0) {
                        throw new Error('All sections failed to extract. Extraction errors: ' + JSON.stringify(extractionErrors));
                    }
                    usageData = {
                        lastUpdated: new Date().toISOString(),
                        isPartial: sectionsExtracted < totalSections,
                    };
                    if (currentSession) {
                        usageData.currentSession = currentSession;
                    }
                    if (allModels && sonnetOnly) {
                        usageData.weeklyLimits = {
                            allModels: allModels,
                            sonnetOnly: sonnetOnly,
                        };
                    }
                    else if (allModels || sonnetOnly) {
                        // Partial weekly limits data - only include what we have
                        usageData.weeklyLimits = {
                            allModels: allModels || { resetsIn: '', percentageUsed: 0 },
                            sonnetOnly: sonnetOnly || { resetsIn: '', percentageUsed: 0 },
                        };
                    }
                    if (Object.keys(extractionErrors).length > 0) {
                        usageData.extractionErrors = extractionErrors;
                    }
                    // Log result
                    if (usageData.isPartial) {
                        missing = Object.keys(extractionErrors).join(', ');
                        console.log("[Scraper] Partial data extracted (".concat(sectionsExtracted, "/").concat(totalSections, " sections). Missing: ").concat(missing));
                    }
                    else {
                        console.log("[Scraper] Scrape completed successfully (".concat(sectionsExtracted, "/").concat(totalSections, " sections)"));
                    }
                    console.log('[Scraper] Data extracted:', JSON.stringify(usageData, null, 2));
                    // Save to file
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
                    console.log('[Scraper] Saved to:', OUTPUT_FILE);
                    return [2 /*return*/, usageData];
                case 25: return [4 /*yield*/, browser.close()];
                case 26:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 27: return [2 /*return*/];
            }
        });
    });
}
export { scrape };
// Run if called directly (ESM-compatible check)
if (import.meta.url === "file://".concat(process.argv[1])) {
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
