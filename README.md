# Scanline 🔍

Scanline is a lightweight, local-first Chrome and Chromium extension that performs mathematical and heuristic analysis on Amazon product reviews to detect potential manipulation, bot-generated feedback, and suspicious rating skews.
Note:- Login required on Amazon to work fully.

## Features
- **Zero API Fees:** Runs 100% locally in your browser using a custom jQuery parser.
- **Rating Spread Analysis:** Checks for artificial 5-star skews.
- **Text Similarity (Jaccard Index):** Identifies copy-pasted or templated review clusters.
- **Verified Purchase Ratio:** Measures how many reviewers actually bought the product.
- **Phrasing Analysis:** Spots high density of repetitive, low-effort filler phrases.

## Free "One-Click" Install Store Links
- **[Download for Microsoft Edge](YOUR_EDGE_STORE_LINK_HERE)** *(Works on Chrome and Brave too!)*
- **[Download for Firefox](YOUR_FIREFOX_STORE_LINK_HERE)**

---

## How to Install Manually (Developer Mode)
If you want to run the latest raw code directly from this repository on any Chromium browser (Chrome, Brave, Edge, Opera, Vivaldi):

1. Click the green **Code** button at the top of this page and select **Download ZIP**.
2. Extract the ZIP file to a folder on your computer.
3. Open your browser and navigate to the Extensions management page:
   - **Chrome:** `chrome://extensions`
   - **Brave:** `brave://extensions`
   - **Edge:** `edge://extensions`
4. Toggle **Developer Mode** to **ON** (usually a switch in the top-right or top-left corner).
5. Click the **Load unpacked** button.
6. Select the extracted folder containing the `manifest.json` file.
7. Click the Scanline extension icon in your browser bar and start scanning!
