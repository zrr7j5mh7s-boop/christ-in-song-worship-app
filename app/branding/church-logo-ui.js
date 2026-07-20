(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderSettingsPanel(settings) {
    const logo = settings || {};
    const hasLogo = window.CISChurchLogoSettings?.hasCustomLogo(logo);
    return `
      <section class="section church-logo-settings" aria-labelledby="churchLogoSettingsTitle">
        <h2 id="churchLogoSettingsTitle">Church Logo</h2>
        <p class="muted">Upload a local logo for live projection. Images stay on this device only.</p>
        <div class="church-logo-preview ${hasLogo ? "has-logo" : "is-default"}" aria-live="polite">
          ${hasLogo
    ? `<img src="${escapeHtml(logo.imageDataUrl)}" alt="Church logo preview" class="church-logo-preview-image">`
    : `<div class="church-logo-preview-default"><span aria-hidden="true">✦</span><strong>Default logo screen</strong></div>`}
        </div>
        <div class="button-row church-logo-actions">
          <label class="secondary-button church-logo-file-label">
            ${hasLogo ? "Replace logo" : "Choose logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" data-command="church-logo-import" hidden>
          </label>
          ${hasLogo ? `<button class="secondary-button" type="button" data-command="church-logo-remove">Remove logo</button>` : ""}
          <button class="secondary-button" type="button" data-command="emergency-logo">Show live</button>
          <button class="secondary-button" type="button" data-command="emergency-clear">Hide / clear</button>
        </div>
        ${logo.fileName ? `<p class="muted">Current file: ${escapeHtml(logo.fileName)}</p>` : ""}
      </section>
    `;
  }

  function renderBackgroundPanel(projectionSettings) {
    const settings = projectionSettings || {};
    const bundled = window.CISProjectionBackgrounds?.listBundled?.() || [];
    const activeId = settings.backgroundId || "black";
    return `
      <section class="section projection-background-settings" aria-labelledby="projectionBackgroundTitle">
        <h2 id="projectionBackgroundTitle">Projector Background</h2>
        <p class="muted">Choose a background for hymn and Bible projection output.</p>
        <div class="projection-background-grid" role="radiogroup" aria-label="Projector background">
          ${bundled.map((item) => `
            <label class="projection-background-option ${activeId === item.id ? "active" : ""}">
              <input type="radio" name="projectionBackground" value="${escapeHtml(item.id)}" data-command="set-projection-background" ${activeId === item.id ? "checked" : ""}>
              <span class="projection-background-swatch" style="background:${item.css};"></span>
              <span>${escapeHtml(item.label)}</span>
            </label>
          `).join("")}
          <label class="projection-background-option ${activeId === "custom" ? "active" : ""}">
            <input type="radio" name="projectionBackground" value="custom" data-command="set-projection-background-custom" ${activeId === "custom" ? "checked" : ""}>
            <span class="projection-background-swatch ${settings.customBackgroundDataUrl ? "has-image" : ""}" ${settings.customBackgroundDataUrl ? `style="background:url('${escapeHtml(settings.customBackgroundDataUrl)}') center / cover no-repeat;"` : ""}></span>
            <span>Custom image</span>
          </label>
        </div>
        <div class="button-row projection-background-actions">
          <label class="secondary-button church-logo-file-label">
            Choose custom background
            <input type="file" accept="image/png,image/jpeg,image/webp" data-command="projection-background-import" hidden>
          </label>
          ${settings.customBackgroundDataUrl ? `<button class="secondary-button" type="button" data-command="projection-background-clear-custom">Remove custom</button>` : ""}
        </div>
      </section>
    `;
  }

  window.CISChurchLogoUI = {
    configure,
    renderSettingsPanel,
    renderBackgroundPanel,
  };
})();
