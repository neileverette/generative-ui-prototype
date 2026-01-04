# LangFlow Connection Guide - CRITICAL FIX

## The Problem
Your Python Interpreter is outputting `url_input` with the complete Datadog API URL, but the API Request component isn't receiving it. This is why you're still getting "Forbidden" errors with the old host-specific query.

## The Solution: Connect Python Interpreter Output to API Request Input

### Step-by-Step Instructions

#### Step 1: Locate the Connection Points

In LangFlow, each component has small circular dots on its edges. These are connection ports:
- **Output ports** (on the right side): Data this component produces
- **Input ports** (on the left side): Data this component needs

#### Step 2: Delete the Old Connection (if exists)

1. Look for a line connecting **Python Interpreter** to **API Request**
2. Click on that line to select it
3. Press **Delete** or **Backspace** to remove it

#### Step 3: Create the New Connection

**CRITICAL:** The API Request component in URL mode should have an input field that can accept dynamic URLs.

**Option A - If you see input ports:**
1. Find the **output port** on the right side of the **Python Interpreter** component
   - It should be labeled something like "output" or "result"
2. Find the **input port** on the left side of the **API Request** component
   - Look for one labeled "URL" or "url_input"
3. **Click and drag** from the Python Interpreter's output port to the API Request's URL input port
4. A line should appear connecting them

**Option B - If API Request has a text field for URL:**
1. Click on the **API Request** component to open its settings
2. Look for the **URL** field
3. You might see a small **plug icon** or **variable icon** (🔌 or {x}) next to it
4. Click that icon to make it accept input from another component
5. Then connect Python Interpreter's output to that field

**Option C - Try cURL Mode:**
If URL mode doesn't accept dynamic input:
1. Click the **Mode toggle** to switch from URL to **cURL**
2. In cURL mode, you might be able to reference the Python Interpreter's output
3. The cURL command would be:
   ```
   curl "{url_input}" -H "DD-API-KEY: ***REMOVED***" -H "DD-APPLICATION-KEY: ***REMOVED***"
   ```

#### Step 4: Verify the Connection

After making the connection:
1. The Python Interpreter should show `url_input` in its output
2. The API Request should show it's receiving that input
3. Test with a query: "What is my CPU usage?"

#### Step 5: Check the Headers

The API Request still needs these headers (regardless of URL or cURL mode):

**In URL Mode:**
- Header 1: `DD-API-KEY: ***REMOVED***`
- Header 2: `DD-APPLICATION-KEY: ***REMOVED***`

**In cURL Mode:**
Include as `-H` flags in the cURL command

## What Should Happen

Once connected correctly:
1. User asks: "What is my memory usage?"
2. Python Interpreter matches "memory" keyword
3. Python Interpreter outputs: `url_input = "https://api.us5.datadoghq.com/api/v1/query?from=1735923600&to=1735927200&query=100 * (avg:system.mem.total{*} - avg:system.mem.usable{*}) / avg:system.mem.total{*}"`
4. API Request receives that URL and makes the request
5. Agent interprets the response

## Troubleshooting

### "I don't see connection ports"
- Try clicking on the component first to select it
- Look very carefully at the edges - ports are small circles
- Try zooming in on the LangFlow canvas

### "The connection keeps disconnecting"
- The output type from Python Interpreter must match the input type for API Request
- Make sure the Python code ends with `result` (which outputs the dictionary)

### "Still getting Forbidden errors after connecting"
- Click on the Python Interpreter and verify the code includes `{*}` wildcards
- Check that the API Request is actually using the new URL (not a cached old one)
- Try disconnecting and reconnecting the components

### "Can't switch to cURL mode"
- Some versions of LangFlow lock the mode
- Try creating a new API Request component in cURL mode from scratch

## Quick Visual Reference

```
┌─────────────────────┐         ┌──────────────────┐
│ Python Interpreter  │────────▶│  API Request     │
│                     │         │                  │
│ Output:             │         │ Input: url_input │
│ - url_input         │         │ Mode: URL        │
│ - query             │         │ Method: GET      │
│ - from              │         │ Headers: DD-*    │
│ - to                │         │                  │
└─────────────────────┘         └──────────────────┘
```

The arrow represents the connection you need to create by dragging from the output port to the input port.
