(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function categoryLabel(id) {
    const cat = window.CISHelpContent ? window.CISHelpContent.getCategory(id) : null;
    return cat ? cat.title : id;
  }

  function renderHeader(helpState, desktopInfo) {
    const version = desktopInfo?.version || "1.0.0";
    const recent = window.CISHelpStore ? window.CISHelpStore.getRecentArticles().slice(0, 4) : [];
    const recentHtml = recent.length
      ? `<div class="help-recent"><span class="muted">Recently viewed:</span> ${recent.map((id) => {
        const article = window.CISHelpContent.getArticle(id);
        return article ? `<button type="button" class="help-recent-link" data-help-article="${escapeHtml(article.id)}">${escapeHtml(article.title)}</button>` : "";
      }).join(" · ")}</div>`
      : "";
    const recentSearches = window.CISHelpStore ? window.CISHelpStore.getRecentSearches().slice(0, 5) : [];
    const searchSuggestHtml = recentSearches.length && !helpState.searchQuery
      ? `<div class="help-recent"><span class="muted">Recent searches:</span> ${recentSearches.map((q) => `<button type="button" class="help-recent-link" data-help-search="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join(" · ")}</div>`
      : "";

    return `
      <header class="help-header section">
        <div class="help-header-top">
          <div>
            <p class="eyebrow">Support · Offline help available</p>
            <h2>Help Centre</h2>
            <p class="muted">Find instructions, service workflows, troubleshooting steps and emergency support for the Christ in Song Digital Worship System.</p>
          </div>
          <div class="help-header-meta">
            <span class="help-version" title="Application version">v${escapeHtml(version)}</span>
            <button type="button" class="secondary-button" data-help-nav="home" aria-label="Help home">${window.CISHelpIcons ? window.CISHelpIcons.renderIcon("home") : ""} Home</button>
            ${helpState.category || helpState.articleId ? `<button type="button" class="secondary-button" data-command="help-back">Back</button>` : ""}
          </div>
        </div>
        <div class="help-search-bar">
          <label class="help-search-label" for="helpSearchInput">${window.CISHelpIcons ? window.CISHelpIcons.renderIcon("search", "help-search-ico") : ""}<span>Search Help</span></label>
          <input id="helpSearchInput" type="search" value="${escapeHtml(helpState.searchQuery || "")}" placeholder="How do I show a verse in OBS?" autocomplete="off" aria-label="Search help articles">
          ${helpState.searchQuery ? `<button type="button" class="secondary-button" data-command="help-clear-search">Clear</button>` : ""}
        </div>
        ${recentHtml}
        ${searchSuggestHtml}
      </header>
    `;
  }

  function renderCategoryCards() {
    const cats = window.CISHelpContent ? window.CISHelpContent.CATEGORIES : [];
    return `
      <div class="help-card-grid" role="navigation" aria-label="Help categories">
        ${cats.map((cat) => `
          <button type="button" class="help-card" data-help-category="${escapeHtml(cat.id)}" aria-label="${escapeHtml(cat.title)}">
            ${window.CISHelpIcons ? window.CISHelpIcons.renderIcon(cat.icon, "help-card-icon") : ""}
            <strong>${escapeHtml(cat.title)}</strong>
            <span>${escapeHtml(cat.description)}</span>
          </button>
        `).join("")}
        <button type="button" class="help-card" data-help-nav="glossary" aria-label="Glossary">
          ${window.CISHelpIcons ? window.CISHelpIcons.renderIcon("glossary", "help-card-icon") : ""}
          <strong>Glossary</strong>
          <span>Worship, OBS, and projection terms explained.</span>
        </button>
        <button type="button" class="help-card" data-help-nav="faq" aria-label="Frequently asked questions">
          ${window.CISHelpIcons ? window.CISHelpIcons.renderIcon("faq", "help-card-icon") : ""}
          <strong>FAQs</strong>
          <span>Quick answers to common operator questions.</span>
        </button>
        <button type="button" class="help-card" data-help-nav="diagnostics" aria-label="Diagnostics">
          ${window.CISHelpIcons ? window.CISHelpIcons.renderIcon("diagnostics", "help-card-icon") : ""}
          <strong>Diagnostics</strong>
          <span>System status, OBS health, and exportable reports.</span>
        </button>
      </div>
    `;
  }

  function renderSearchResults(helpState) {
    if (!helpState.searchQuery) return "";
    const result = window.CISHelpSearch ? window.CISHelpSearch.search(helpState.searchQuery) : { results: [] };
    if (!result.results.length) {
      return `<section class="section help-search-results"><p class="help-no-results">No results for “${escapeHtml(helpState.searchQuery)}”. Try “OBS disconnected”, “projector blank”, or “add hymn”.</p></section>`;
    }
    return `
      <section class="section help-search-results" aria-live="polite">
        <h3>${result.results.length} result${result.results.length === 1 ? "" : "s"}</h3>
        <div class="help-article-list">
          ${result.results.map((row) => `
            <article class="help-result-card">
              <div>
                <span class="help-result-cat">${escapeHtml(categoryLabel(row.category))}</span>
                <h4>${window.CISHelpSearch ? window.CISHelpSearch.highlight(row.title, row.matches, "title") : escapeHtml(row.title)}</h4>
                <p>${escapeHtml(row.description)}</p>
                <small class="muted">${row.readMinutes} min read</small>
              </div>
              <button type="button" class="action-button" data-help-article="${escapeHtml(row.id.startsWith("glossary-") || row.id.startsWith("faq-") ? (row.article?.id || row.id) : row.id)}">Open</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderArticleBody(article) {
    if (!article) return `<p class="muted">Article not found.</p>`;
    const sections = [];
    if (article.whatItDoes) sections.push(`<section><h3>What it does</h3><p>${escapeHtml(article.whatItDoes)}</p></section>`);
    if (article.whenToUse) sections.push(`<section><h3>When to use it</h3><p>${escapeHtml(article.whenToUse)}</p></section>`);
    if (article.howToUse && article.howToUse.length) {
      sections.push(`<section><h3>How to use it</h3><ol>${article.howToUse.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol></section>`);
    }
    if (article.workflow) sections.push(`<section><h3>Example workflow</h3><p>${escapeHtml(article.workflow)}</p></section>`);
    if (article.diagram) sections.push(`<section><h3>Diagram</h3><pre class="help-diagram">${escapeHtml(article.diagram)}</pre></section>`);
    if (article.examples && article.examples.length) sections.push(`<section><h3>Examples</h3><ul>${article.examples.map((e) => `<li><code>${escapeHtml(e)}</code></li>`).join("")}</ul></section>`);
    if (article.shortcuts && article.shortcuts.length) {
      sections.push(`<section><h3>Shortcuts</h3><div class="help-shortcut-table">${article.shortcuts.map((s) => `<div class="help-shortcut-row"><kbd>${escapeHtml(s.keys)}</kbd><span>${escapeHtml(s.action)}</span><small>${escapeHtml(s.scope)}</small></div>`).join("")}</div></section>`);
    }
    if (article.notes && article.notes.length) sections.push(`<section class="help-note"><h3>Important notes</h3><ul>${article.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></section>`);
    if (article.mistakes && article.mistakes.length) sections.push(`<section class="help-warning"><h3>Common mistakes</h3><ul>${article.mistakes.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul></section>`);
    if (article.troubleshooting && article.troubleshooting.length) {
      sections.push(`<section><h3>Troubleshooting</h3>${article.troubleshooting.map((t) => `
        <div class="help-ts-block">
          <strong>Problem:</strong> ${escapeHtml(t.problem)}<br>
          <strong>Likely cause:</strong> ${escapeHtml(t.cause)}<br>
          <strong>Steps to fix:</strong><ol>${(t.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
          <strong>How to prevent:</strong> ${escapeHtml(t.prevent || "")}
          <p><strong>Still not working?</strong> Open <button type="button" class="help-inline-link" data-help-nav="diagnostics">Diagnostics</button>.</p>
        </div>
      `).join("")}</section>`);
    }
    if (article.shortcut) sections.push(`<section><h3>Keyboard shortcut</h3><p><kbd>${escapeHtml(article.shortcut)}</kbd></p></section>`);
    if (article.checklistId === "setup" && window.CISHelpChecklists && window.CISHelpContent) {
      sections.push(window.CISHelpChecklists.renderChecklist("setup", window.CISHelpContent.SETUP_CHECKLIST, escapeHtml));
    }
    if (article.checklistId === "pre-service" && window.CISHelpChecklists && window.CISHelpContent) {
      sections.push(window.CISHelpChecklists.renderChecklist("pre-service", window.CISHelpContent.PRE_SERVICE_CHECKLIST, escapeHtml));
    }
    if (article.related && article.related.length) {
      sections.push(`<section><h3>Related features</h3><div class="button-row">${article.related.map((id) => {
        const rel = window.CISHelpContent.getArticle(id);
        return rel ? `<button type="button" class="secondary-button" data-help-article="${escapeHtml(id)}">${escapeHtml(rel.title)}</button>` : "";
      }).join("")}</div></section>`);
    }
    const actions = [];
    if (article.route) actions.push(`<button type="button" class="action-button" data-view="${escapeHtml(article.route)}">Open ${escapeHtml(article.route)}</button>`);
    if (article.routeCommand) actions.push(`<button type="button" class="secondary-button" data-command="${escapeHtml(article.routeCommand)}">Go to feature</button>`);
    actions.push(`<button type="button" class="secondary-button" data-help-bookmark="${escapeHtml(article.id)}">${window.CISHelpStore && window.CISHelpStore.isBookmarked(article.id) ? "Remove bookmark" : "Bookmark"}</button>`);

    return `
      <article class="section help-article">
        <p class="eyebrow">${escapeHtml(categoryLabel(article.category))} · ${article.readMinutes || 3} min read</p>
        <h2>${escapeHtml(article.title)}</h2>
        <p class="muted">${escapeHtml(article.description || "")}</p>
        <div class="button-row help-article-actions">${actions.join("")}</div>
        <div class="help-article-body">${sections.join("")}</div>
      </article>
    `;
  }

  function renderCategory(categoryId) {
    if (categoryId === "emergency") return renderEmergency();
    if (categoryId === "training") return window.CISHelpTraining ? window.CISHelpTraining.renderTraining(escapeHtml) : "";
    const articles = window.CISHelpContent ? window.CISHelpContent.getArticlesByCategory(categoryId).filter((a) => window.CISHelpStore.canSeeArticle(a)) : [];
    const cat = window.CISHelpContent.getCategory(categoryId);
    return `
      <section class="section">
        <h2>${escapeHtml(cat ? cat.title : categoryId)}</h2>
        <p class="muted">${escapeHtml(cat ? cat.description : "")}</p>
        <div class="help-article-list">
          ${articles.map((article) => `
            <article class="help-result-card">
              <div>
                <h4>${escapeHtml(article.title)}</h4>
                <p>${escapeHtml(article.description || "")}</p>
                <small class="muted">${article.readMinutes || 3} min</small>
              </div>
              <button type="button" class="action-button" data-help-article="${escapeHtml(article.id)}">Open</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderEmergency() {
    return `
      <section class="section help-emergency">
        <h2>Emergency Help</h2>
        <p class="muted">Large actions for live service recovery. Streaming and recording are not stopped by overlay clears.</p>
        <div class="help-emergency-grid">
          <button type="button" class="help-emergency-btn" data-command="obs-clear-overlays" data-confirm="true">Clear all worship overlays</button>
          <button type="button" class="help-emergency-btn" data-command="emergency-clear">Clear / return to lyrics</button>
          <button type="button" class="help-emergency-btn" data-command="emergency-logo">Show church logo</button>
          <button type="button" class="help-emergency-btn warn" data-command="emergency-black" data-confirm="true">Blackout projector</button>
          <button type="button" class="help-emergency-btn" data-command="obs-connect">Reconnect OBS</button>
          <button type="button" class="help-emergency-btn" data-command="presenter-open-output">Restart projector output</button>
          <button type="button" class="help-emergency-btn" data-command="help-open-diagnostics">Open diagnostics</button>
          <button type="button" class="help-emergency-btn" data-command="help-copy-diagnostics">Copy diagnostic report</button>
          <button type="button" class="help-emergency-btn" data-command="export-backup">Create backup now</button>
          <button type="button" class="help-emergency-btn" data-command="camera-switch-backup">Switch to backup camera</button>
          <button type="button" class="help-emergency-btn" data-command="camera-send-live">Show main camera</button>
          <button type="button" class="help-emergency-btn" data-command="camera-freeze-off">Stop frozen camera</button>
          <button type="button" class="help-emergency-btn" data-command="camera-restart">Restart camera source</button>
          <button type="button" class="help-emergency-btn" data-command="camera-refresh-devices">Refresh camera devices</button>
          <button type="button" class="help-emergency-btn" data-command="emergency-logo">Show church logo</button>
          <button type="button" class="help-emergency-btn warn" data-command="emergency-black" data-confirm="true">Blackout selected projectors</button>
          <button type="button" class="help-emergency-btn" data-command="camera-return-previous">Return to previous live item</button>
        </div>
      </section>
    `;
  }

  function renderGlossary() {
    const items = window.CISHelpContent ? window.CISHelpContent.GLOSSARY : [];
    return `
      <section class="section help-glossary">
        <h2>Glossary</h2>
        <div class="help-glossary-list">
          ${items.map((item) => `
            <article class="help-glossary-item">
              <h3>${escapeHtml(item.term)}</h3>
              <p>${escapeHtml(item.definition)}</p>
              ${item.articleId ? `<button type="button" class="secondary-button" data-help-article="${escapeHtml(item.articleId)}">Related article</button>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderFAQ() {
    const faqs = window.CISHelpContent ? window.CISHelpContent.FAQS : [];
    return `
      <section class="section help-faq">
        <h2>Frequently Asked Questions</h2>
        <div class="help-faq-list">
          ${faqs.map((faq) => `
            <details class="help-faq-item">
              <summary>${escapeHtml(faq.q)}</summary>
              <p>${escapeHtml(faq.a)}</p>
              ${faq.articleId ? `<button type="button" class="secondary-button" data-help-article="${escapeHtml(faq.articleId)}">Read more</button>` : ""}
            </details>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderAbout(desktopInfo) {
    const version = desktopInfo?.version || "1.0.0";
    const seen = window.CISHelpStore ? window.CISHelpStore.getWhatsNewSeen() : "";
    const whatsNew = version !== seen;
    return `
      <section class="section help-about">
        <h2>About and Updates</h2>
        ${whatsNew ? `<div class="help-whats-new"><strong>What's New in v${escapeHtml(version)}</strong><ul><li>Help Centre with offline search and emergency tools</li><li>OBS Studio integration (WebSocket 5.x, Browser Sources)</li><li>Interactive pre-service and setup checklists</li><li>Training Mode for operator practice</li></ul><button type="button" class="secondary-button" data-command="help-dismiss-whats-new">Dismiss</button></div>` : ""}
        <dl class="help-about-grid">
          <div><dt>Application</dt><dd>Christ in Song Worship App</dd></div>
          <div><dt>Version</dt><dd>${escapeHtml(version)}</dd></div>
          <div><dt>OBS integration</dt><dd>WebSocket 5.x · Browser Source server</dd></div>
          <div><dt>Bible translations</dt><dd>KJV, ASV, WEB (public domain)</dd></div>
          <div><dt>Support</dt><dd>juliuschinoda@gmail.com</dd></div>
        </dl>
        <p class="muted">Hymn and Bible content notices: use licensed packs only. Open-source components listed in packaged build metadata.</p>
        <label class="field compact">Help role view
          <select id="helpRoleSelect" aria-label="Help role">
            <option value="operator">Worship operator</option>
            <option value="admin">Administrator</option>
            <option value="editor">Content editor</option>
            <option value="remote">Remote assistant</option>
          </select>
        </label>
      </section>
    `;
  }

  function render(helpState, context) {
    if (!window.CISHelpContent) return `<section class="section"><p>Help Centre loading…</p></section>`;
    const ctx = context || {};
    let body = "";

    if (helpState.articleId) {
      const article = window.CISHelpContent.getArticle(helpState.articleId);
      if (article && window.CISHelpStore) {
        window.CISHelpStore.addRecentArticle(article.id);
        window.CISHelpStore.recordAnalytics("help_article_open", { id: article.id });
      }
      body = renderArticleBody(article);
    } else if (helpState.nav === "glossary") body = renderGlossary();
    else if (helpState.nav === "faq") body = renderFAQ();
    else if (helpState.nav === "diagnostics" && window.CISHelpDiagnostics) {
      body = window.CISHelpDiagnostics.renderDiagnostics(ctx.diagnosticsReport || {}, escapeHtml);
    } else if (helpState.nav === "about") body = renderAbout(ctx.desktopInfo);
    else if (helpState.category) body = renderCategory(helpState.category);
    else {
      body = `${renderCategoryCards()}${renderSearchResults(helpState)}`;
    }

    return `${renderHeader(helpState, ctx.desktopInfo)}${body}`;
  }

  window.CISHelpUI = {
    configure,
    render,
    renderEmergency,
    categoryLabel,
  };
})();
