(function () {
  "use strict";

  let fuse = null;
  let index = [];

  function buildIndex() {
    if (!window.CISHelpContent) return [];
    const rows = [];
    window.CISHelpContent.ARTICLES.forEach((article) => {
      if (window.CISHelpStore && !window.CISHelpStore.canSeeArticle(article)) return;
      rows.push({
        id: article.id,
        title: article.title,
        description: article.description || "",
        category: article.category,
        keywords: (article.keywords || []).join(" "),
        aliases: (article.aliases || []).join(" "),
        body: [
          article.whatItDoes,
          article.whenToUse,
          (article.howToUse || []).join(" "),
          article.workflow,
          (article.notes || []).join(" "),
        ].filter(Boolean).join(" "),
        readMinutes: article.readMinutes || 3,
        article,
      });
    });
    window.CISHelpContent.GLOSSARY.forEach((item) => {
      rows.push({
        id: `glossary-${item.term}`,
        title: `Glossary: ${item.term}`,
        description: item.definition,
        category: "glossary",
        keywords: item.term,
        aliases: "",
        body: item.definition,
        readMinutes: 1,
        article: { id: item.articleId, category: "glossary", title: item.term },
        glossaryTerm: item.term,
      });
    });
    window.CISHelpContent.FAQS.forEach((faq, idx) => {
      rows.push({
        id: `faq-${idx}`,
        title: faq.q,
        description: faq.a,
        category: "faq",
        keywords: faq.q,
        aliases: faq.a,
        body: `${faq.q} ${faq.a}`,
        readMinutes: 1,
        article: { id: faq.articleId, category: "faq", title: faq.q },
      });
    });
    index = rows;
    if (typeof window.Fuse !== "undefined") {
      fuse = new window.Fuse(rows, {
        keys: [
          { name: "title", weight: 0.35 },
          { name: "description", weight: 0.2 },
          { name: "keywords", weight: 0.2 },
          { name: "aliases", weight: 0.15 },
          { name: "body", weight: 0.1 },
        ],
        threshold: 0.42,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 2,
      });
    } else {
      fuse = null;
    }
    return rows;
  }

  function highlight(text, matches, key) {
    if (!matches || !text) return text;
    const match = matches.find((item) => item.key === key);
    if (!match || !match.indices || !match.indices.length) return text;
    let output = "";
    let last = 0;
    match.indices.forEach(([start, end]) => {
      output += text.slice(last, start);
      output += `<mark class="help-mark">${text.slice(start, end + 1)}</mark>`;
      last = end + 1;
    });
    output += text.slice(last);
    return output;
  }

  function fallbackSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return index.filter((row) => (
      row.title.toLowerCase().includes(q)
      || row.description.toLowerCase().includes(q)
      || row.keywords.toLowerCase().includes(q)
      || row.aliases.toLowerCase().includes(q)
      || row.body.toLowerCase().includes(q)
    )).slice(0, 20);
  }

  function search(query) {
    const q = String(query || "").trim();
    if (!q) return { query: q, results: [], suggestions: [] };
    if (!index.length) buildIndex();

    let results = [];
    if (fuse) {
      results = fuse.search(q, { limit: 20 }).map((entry) => ({
        ...entry.item,
        score: entry.score,
        matches: entry.matches,
      }));
    } else {
      results = fallbackSearch(q);
    }

    if (window.CISHelpStore) {
      window.CISHelpStore.addRecentSearch(q);
      window.CISHelpStore.recordAnalytics("help_search", { query: q, count: results.length });
    }

    const suggestions = index
      .filter((row) => row.title.toLowerCase().startsWith(q.toLowerCase().slice(0, 2)))
      .slice(0, 5)
      .map((row) => row.title);

    return { query: q, results, suggestions };
  }

  function init() {
    return buildIndex();
  }

  window.CISHelpSearch = { init, search, buildIndex, highlight };
})();
