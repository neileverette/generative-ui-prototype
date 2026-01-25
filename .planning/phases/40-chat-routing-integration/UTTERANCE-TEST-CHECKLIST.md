# Utterance Test Checklist

Test all common utterances to verify routing works correctly.

## Legend
- ✅ Routes to widgets (confidence ≥ 40%)
- 💬 Falls back to chat (confidence < 40%)
- 🏠 Returns to landing page

---

## 🏠 Navigation / Home (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | back | Return to landing page |
| [ ] | home | Return to landing page |
| [ ] | go home | Return to landing page |
| [ ] | overview | Return to landing page |
| [ ] | dashboard | Return to landing page |
| [ ] | main | Return to landing page |
| [ ] | clear | Return to landing page |
| [ ] | reset | Return to landing page |
| [ ] | start over | Return to landing page |

---

## 📊 System Metrics / Performance (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | system metrics | Load system metrics widgets |
| [ ] | show metrics | Load system metrics widgets |
| [ ] | performance | Load system metrics widgets |
| [ ] | cpu | Load system metrics widgets |
| [ ] | memory | Load system metrics widgets |
| [ ] | disk | Load system metrics widgets |
| [ ] | system health | Load system metrics widgets |
| [ ] | show system | Load system metrics widgets |
| [ ] | infrastructure | Load system metrics widgets |
| [ ] | how's the system | Load system metrics widgets |
| [ ] | system status | Load system metrics widgets |
| [ ] | server health | Load system metrics widgets |

---

## 💰 AWS Costs (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | costs | Load AWS costs widgets |
| [ ] | show costs | Load AWS costs widgets |
| [ ] | aws costs | Load AWS costs widgets |
| [ ] | spending | Load AWS costs widgets |
| [ ] | billing | Load AWS costs widgets |
| [ ] | how much am I spending | Load AWS costs widgets |
| [ ] | cost breakdown | Load AWS costs widgets |
| [ ] | monthly costs | Load AWS costs widgets |
| [ ] | cloud costs | Load AWS costs widgets |
| [ ] | infrastructure costs | Load AWS costs widgets |

---

## 🐳 Containers (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | containers | Load container widgets |
| [ ] | show containers | Load container widgets |
| [ ] | docker | Load container widgets |
| [ ] | running containers | Load container widgets |
| [ ] | container status | Load container widgets |
| [ ] | ecr | Load container widgets |
| [ ] | images | Load container widgets |
| [ ] | list containers | Load container widgets |
| [ ] | container health | Load container widgets |

---

## ⚙️ Automations (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | automations | Load automation widgets |
| [ ] | show automations | Load automation widgets |
| [ ] | workflows | Load automation widgets |
| [ ] | n8n | Load automation widgets |
| [ ] | automation status | Load automation widgets |
| [ ] | workflow health | Load automation widgets |
| [ ] | automation metrics | Load automation widgets |

---

## 🚀 Deployments (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | deployments | Load deployment widgets |
| [ ] | show deployments | Load deployment widgets |
| [ ] | deployment history | Load deployment widgets |
| [ ] | releases | Load deployment widgets |
| [ ] | recent deployments | Load deployment widgets |
| [ ] | when was last deployment | Load deployment widgets |

---

## 🤖 AI Usage / Claude (Should Route)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | claude usage | Load Claude usage widgets |
| [ ] | ai usage | Load Claude usage widgets |
| [ ] | api credits | Load Claude usage widgets |
| [ ] | token usage | Load Claude usage widgets |
| [ ] | claude credits | Load Claude usage widgets |
| [ ] | anthropic usage | Load Claude usage widgets |
| [ ] | how much claude have I used | Load Claude usage widgets |

---

## 💬 Conversational Queries (Should Fall Back to Chat)

| Status | Utterance | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | how do I configure automations | Conversational response |
| [ ] | what is the weather | Conversational response |
| [ ] | help me understand costs | Conversational response |
| [ ] | explain this to me | Conversational response |
| [ ] | why is CPU high | Conversational response |
| [ ] | how can I reduce costs | Conversational response |
| [ ] | tell me about containers | Conversational response |
| [ ] | what should I do | Conversational response |
| [ ] | can you help me | Conversational response |

---

## 🔄 Deduplication Tests (Should Prevent Duplicates)

| Status | Test Case | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | Type "show costs" twice | Second time says "already displayed" |
| [ ] | Type "system metrics" twice | Second time says "already displayed" |
| [ ] | Type "containers" twice | Second time says "already displayed" |
| [ ] | Type "automations" twice | Second time says "already displayed" |
| [ ] | Type "deployments" twice | Second time says "already displayed" |
| [ ] | Clear dashboard, then "costs" again | Loads widgets again successfully |

---

## 🎯 Edge Cases

| Status | Test Case | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | Type empty string | No action or error handled gracefully |
| [ ] | Type random gibberish "asdfghjkl" | Falls back to conversational response |
| [ ] | Type very long message (500+ chars) | Handles gracefully |
| [ ] | Type message with special chars "cost$$$" | Routes correctly or falls back |
| [ ] | Type uppercase "SHOW COSTS" | Routes correctly (case insensitive) |
| [ ] | Type with extra spaces "  costs  " | Routes correctly (trimmed) |

---

## 🔊 Voice Input Tests

| Status | Test Case | Expected Behavior |
|--------|-----------|-------------------|
| [ ] | Say "show costs" | Loads AWS costs widgets |
| [ ] | Say "system metrics" | Loads system metrics widgets |
| [ ] | Say "containers" | Loads container widgets |
| [ ] | Say "automations" | Loads automation widgets |
| [ ] | Say "back" | Returns to landing page |
| [ ] | Say conversational query | Falls back to chat response |

---

## 📝 Test Results Summary

**Date Tested:** _____________

**Total Tests:** 90+

**Passed:** _____ / _____

**Failed:** _____ / _____

**Issues Found:**
1.
2.
3.

**Notes:**


---

## Testing Instructions

1. **Open Browser DevTools** (F12) → Console tab
2. **Clear dashboard** before each test
3. **Look for console logs:**
   - `[WidgetLoader] Route matched` = routing worked
   - `[WidgetLoader] No route found, falling back to chat` = fallback worked
4. **Check for errors** in console
5. **Verify widgets appear** for routing tests
6. **Verify chat responses** for fallback tests
7. **Mark checkbox** when test passes
8. **Note any issues** in summary section
