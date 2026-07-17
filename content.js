(() => {
  const extractedReviews = [];
  const isAmazon = window.location.hostname.includes('amazon');

  let reviewNodes = [];
  if (isAmazon) {
   
    reviewNodes = document.querySelectorAll('[data-hook="review"]');
  } else {
    // Targeted individual card-level blocks for other e-commerce sites
    reviewNodes = document.querySelectorAll('[itemprop="review"], .review-item, .review-card, .comment-item, .user-review');
    
    // Fallback if the site uses generic classes, but explicitly filtering out giant list wrappers
    if (reviewNodes.length === 0) {
      const broadNodes = document.querySelectorAll('.review, .comment');
      reviewNodes = Array.from(broadNodes).filter(node => {
        const className = node.className.toLowerCase();
        return !className.includes('list') && !className.includes('container') && !className.includes('wrapper') && !className.includes('panel');
      });
    }
  }

  reviewNodes.forEach(node => {
    // ---- RULE 1: MUST BE VISIBLE ----
    if (node.offsetWidth === 0 && node.offsetHeight === 0) return;

    // ---- RULE 2: EXTRACT RATING FROM CARD ONLY ----
    let rating = null;
    const ratingNode = node.querySelector('[data-hook="review-star-rating"], .review-rating, .a-icon-star, [class*="star" i], [class*="rating" i]');
    if (ratingNode) {
      const textVal = ratingNode.getAttribute('aria-label') || ratingNode.getAttribute('title') || ratingNode.textContent || "";
      const match = textVal.match(/([1-5])\s*(?:out of|\/|star)/i) || textVal.match(/([1-5])/);
      if (match) rating = parseInt(match[1]);
    }

    // ---- RULE 3: EXTRACT TEXT FROM SPECIFIC INNER BODY ----
    let text = "";
    const textNode = node.querySelector('[data-hook="review-body"], .review-text, .review-text-content, .content, .comment-text');
    if (textNode) {
      // Amazon wraps the clean inner text inside a nested span
      const span = textNode.querySelector('span');
      text = span ? span.textContent.trim() : textNode.textContent.trim();
    } else {
      // Fallback for non-Amazon elements: grab the paragraphs inside the card
      const p = node.querySelector('p');
      if (p) text = p.textContent.trim();
    }

    // Clean up typical interface text noise
    text = text.replace(/media collapsed/gi, "").replace(/one person found this helpful/gi, "").trim();

    // ---- RULE 4: PROSE SANITY FILTERS ----
    const isNoise = /^(report|helpful|share|comment|reply|write a review|customer reviews|sign in|be the first)$/i.test(text);
    if (text.length > 20 && text.length < 2000 && !isNoise && text.includes(" ")) {
      
      // Extract Verified Status safely from inside the card
      const verifiedNode = node.querySelector('[data-hook="avp-badge"], .verified-badge, .a-color-state');
      const verified = verifiedNode !== null && /verified|purchase/i.test(verifiedNode.textContent);
      
      extractedReviews.push({ rating, verified, text });
    }
  });

  // ---- RULE 5: DEDUPLICATE ----
  const seenText = new Set();
  const finalReviews = extractedReviews.filter(r => {
    const norm = r.text.toLowerCase().substring(0, 40);
    if (seenText.has(norm)) return false;
    seenText.add(norm);
    return true;
  });

  return finalReviews.slice(0, 20); 
})();
