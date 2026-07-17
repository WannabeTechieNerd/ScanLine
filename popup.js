
const CONFIG_URL = "https://raw.githubusercontent.com/WannabeTechieNerd/ScanLine/refs/heads/main/config.json";

//FALLBACKS (If GitHub is unreachable)
const FALLBACK_CONFIG = {
  reviewContainer: '#cm_cr-review_list [data-hook="review"]',
  ratingSelector: '[data-hook="review-star-rating"], .review-rating',
  verifiedSelector: '[data-hook="avp-badge"]',
  reviewTextSelector: '[data-hook="review-body"]'
};

async function getSelectors() {
  try {
    const response = await fetch(CONFIG_URL);
    return response.ok ? await response.json() : FALLBACK_CONFIG;
  } catch (e) { return FALLBACK_CONFIG; }
}

document.getElementById('scanBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const scanBtn = document.getElementById('scanBtn');
  const previewBox = document.getElementById('previewBox');
  
  const urlMatch = tab.url.match(/https?:\/\/(www\.)?(amazon\.[a-z\.]+)\b/i);
  const asinMatch = tab.url.match(/(?:\/dp\/|gp\/product\/|exec\/obidos\/asin\/|d\/)([A-Z0-9]{10})(?:[\/?]|$)/i);

  if (!urlMatch || !asinMatch) {
    alert("Please navigate to a valid Amazon product page first!");
    return;
  }

  // Fetch the latest selectors from GitHub repo
  const selectors = await getSelectors();
  
  const domain = urlMatch[2]; 
  const asin = asinMatch[1]; 

  scanBtn.disabled = true;
  scanBtn.textContent = "Deep Querying Logs...";
  previewBox.innerHTML = `<div class="preview-item" style="color:var(--accent);">Parsing directory logs with jQuery engine...</div>`;

  try {
    let allLiveReviews = [];

    for (let page = 1; page <= 2; page++) {
      const targetReviewUrl = `https://${domain}/product-reviews/${asin}/?pageNumber=${page}&sortBy=recent`;
      const response = await fetch(targetReviewUrl);
      if (!response.ok) continue;

      const htmlText = await response.text();
      const $html = $(htmlText);
      
      // Using selectors from remote config
      $html.find(selectors.reviewContainer).each((i, element) => {
        const node = $(element);

        let rating = null;
        const ratingText = node.find(selectors.ratingSelector).text();
        const ratingMatch = ratingText.match(/([1-5])/);
        if (ratingMatch) rating = parseInt(ratingMatch[1]);

        const verified = node.find(selectors.verifiedSelector).length > 0;

        let text = node.find(selectors.reviewTextSelector).text().trim();
        text = text.replace(/media collapsed/gi, "").replace(/one person found this helpful/gi, "").trim();

        if (text.length > 15) {
          allLiveReviews.push({ rating, verified, text });
        }
      });
    }

    if (allLiveReviews.length === 0) {
      previewBox.innerHTML = `<div class="preview-item" style="color:var(--red);">Zero actual reviews found.</div>`;
      alert("No customer reviews exist for this product identifier.");
      return;
    }

    previewBox.innerHTML = allLiveReviews.map((r, i) => `
      <div class="preview-item">
        <strong>[#${i+1}] Rating: ${r.rating || 'N/A'}★ | ${r.verified ? 'Verified' : 'Unverified'}</strong><br>
        "${r.text.substring(0, 90)}${r.text.length > 90 ? '...' : ''}"
      </div>
    `).join('');

    analyzeReviews(allLiveReviews);

  } catch (error) {
    console.error("Scraper Engine Failure:", error);
    alert("Network request timed out or was rejected by target server.");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan This Page's Reviews";
  }
});




// Heuristics Helper Functions
function normalize(text){
  return text.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
}

function jaccard(a,b){
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const inter = [...setA].filter(x=>setB.has(x)).length;
  const union = new Set([...setA,...setB]).size;
  return union===0 ? 0 : inter/union;
}

// Heuristics Analysis Engine
function analyzeReviews(reviews) {
  const n = reviews.length;
  document.getElementById('results').style.display = 'block';

  // Signal 1: rating skew
  const rated = reviews.filter(r=>r.rating!==null);
  const fiveStar = rated.filter(r=>r.rating===5).length;
  const oneToThree = rated.filter(r=>r.rating<=3).length;
  const fiveStarPct = rated.length ? fiveStar/rated.length : 0;
  let skewScore, skewStatus, skewDetail;
  if(rated.length === 0){
    skewScore = 15; skewStatus='warn'; skewDetail = 'No explicit star data processed.';
  } else if(fiveStarPct > 0.85 && oneToThree/rated.length < 0.05){
    skewScore = 5; skewStatus='bad';
    skewDetail = Math.round(fiveStarPct*100)+'% five-star with almost no 1-3 star reviews.';
  } else if(fiveStarPct > 0.7){
    skewScore = 15; skewStatus='warn';
    skewDetail = Math.round(fiveStarPct*100)+'% five-star rating skew.';
  } else {
    skewScore = 25; skewStatus='ok';
    skewDetail = 'Rating distribution looks like a natural, organic spread.';
  }

  // Signal 2: duplicate text
  const norm = reviews.map(r=>normalize(r.text));
  let dupPairs = 0;
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      if(norm[i] && norm[j] && jaccard(norm[i],norm[j]) > 0.75){
        dupPairs++;
      }
    }
  }
  const dupRatio = dupPairs / (n*(n-1)/2 || 1);
  let dupScore, dupStatus, dupDetail;
  if(dupRatio > 0.15){
    dupScore = 5; dupStatus='bad';
    dupDetail = dupPairs+' duplicate or templated reviews found out of '+n+' items.';
  } else if(dupRatio > 0.05){
    dupScore = 15; dupStatus='warn';
    dupDetail = dupPairs+' similar text clusters detected.';
  } else {
    dupScore = 25; dupStatus='ok';
    dupDetail = 'No duplicate templates or copy-pasted review texts found.';
  }

  // Signal 3: verified purchase ratio
  const withVerifiedData = reviews.filter(r=>r.verified!==null);
  const verifiedCount = withVerifiedData.filter(r=>r.verified===true).length;
  const verifiedPct = withVerifiedData.length ? verifiedCount/withVerifiedData.length : null;
  let verScore, verStatus, verDetail;
  if(verifiedPct === null){
    verScore = 12; verStatus='warn';
    verDetail = 'Verified badge metrics are unavailable.';
  } else if(verifiedPct < 0.4){
    verScore = 5; verStatus='bad';
    verDetail = 'Only '+Math.round(verifiedPct*100)+'% of scanned reviews are Verified Purchases.';
  } else if(verifiedPct < 0.7){
    verScore = 15; verStatus='warn';
    verDetail = Math.round(verifiedPct*100)+'% verified purchase ratio.';
  } else {
    verScore = 25; verStatus='ok';
    verDetail = Math.round(verifiedPct*100)+'% verified purchase ratio (healthy).';
  }

  // Signal 4: generic phrase density
  const genericPhrases = ['highly recommend','five stars','great product','works as described','amazing quality','best purchase','will buy again','as described'];
  let genericHits = 0;
  norm.forEach(t=>{ genericPhrases.forEach(p=>{ if(t.includes(p)) genericHits++; }); });
  const genericRatio = genericHits / n;
  let genScore, genStatus, genDetail;
  if(genericRatio > 1.2){
    genScore = 5; genStatus='bad';
    genDetail = 'Reviews are highly repetitive with generic buyer phrases.';
  } else if(genericRatio > 0.5){
    genScore = 12; genStatus='warn';
    genDetail = 'Mild generic phrase usage found.';
  } else {
    genScore = 15; genStatus='ok';
    genDetail = 'Reviews contain descriptive, organic text details.';
  }

  // Signal 5: length variance
  const lengths = reviews.map(r=>r.text.length);
  const shortCount = lengths.filter(l=>l < 20).length;
  const shortRatio = shortCount / n;
  let lenScore, lenStatus, lenDetail;
  if(shortRatio > 0.4){
    lenScore = 5; lenStatus='bad';
    lenDetail = Math.round(shortRatio*100)+'% of reviews are suspiciously short (under 20 char).';
  } else if(shortRatio > 0.2){
    lenScore = 6; lenStatus='warn';
    lenDetail = Math.round(shortRatio*100)+'% of reviews are short one-liners.';
  } else {
    lenScore = 10; lenStatus='ok';
    lenDetail = 'Review lengths show a healthy variety.';
  }

  const total = skewScore + dupScore + verScore + genScore + lenScore; // max 100
  renderResults(total, n, [
    {icon:'★', name:'Rating spread', status:skewStatus, detail:skewDetail},
    {icon:'⧉', name:'Text similarity', status:dupStatus, detail:dupDetail},
    {icon:'✓', name:'Verified Ratio', status:verStatus, detail:verDetail},
    {icon:'≈', name:'Phrasing', status:genStatus, detail:genDetail},
    {icon:'▤', name:'Review Lengths', status:lenStatus, detail:lenDetail}
  ]);
}

function renderResults(score, n, signals){
  const arc = document.getElementById('gaugeArc');
  const maxDash = 125;
  const offset = maxDash - (maxDash * score/100);
  arc.style.transition = 'stroke 0.3s ease, stroke-dashoffset 0.6s ease';
  setTimeout(()=>{ arc.style.strokeDashoffset = offset; }, 30);

  let color, tag, headline, sub;
  if(score >= 70){
    color = '#4dffb4'; tag='ORGANIC';
    headline = 'Looking good!';
    sub = 'Review patterns appear authentic.';
  } else if(score >= 40){
    color = '#ffb454'; tag='SUSPICIOUS';
    headline = 'Mixed patterns.';
    sub = 'A few signals look unusual.';
  } else {
    color = '#ff6b5e'; tag='MANIPULATED';
    headline = 'High Red Flags!';
    sub = 'Very likely templated or manufactured.';
  }
  arc.style.stroke = color;
  document.getElementById('gaugeScore').innerHTML = score;
  document.getElementById('gaugeScore').style.color = color;
  const tagEl = document.getElementById('verdictTag');
  tagEl.textContent = tag; tagEl.style.color = color;
  document.getElementById('verdictHeadline').textContent = headline;
  document.getElementById('verdictSub').textContent = sub;

  const iconFor = s => s==='ok' ? '✓' : s==='warn' ? '!' : '✕';
  const signalsHTML = signals.map(s => `
    <div class="signal">
      <div class="icon ${s.status}">${iconFor(s.status)}</div>
      <div>
        <strong style="color:var(--ink);">${s.name}</strong>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:2px;">${s.detail}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('signals').innerHTML = signalsHTML;
}