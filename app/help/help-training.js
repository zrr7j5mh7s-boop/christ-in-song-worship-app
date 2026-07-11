(function () {
  "use strict";

  function renderTraining(escapeHtml) {
    const lessons = window.CISHelpContent ? window.CISHelpContent.TRAINING_LESSONS : [];
    const progress = window.CISHelpStore ? window.CISHelpStore.getTrainingProgress() : { lessons: {}, trainingMode: false };
    const active = progress.trainingMode;

    const cards = lessons.map((lesson) => {
      const done = progress.lessons && progress.lessons[lesson.id];
      return `
        <article class="help-training-card ${done ? "done" : ""}">
          <h3>${escapeHtml(lesson.title)}</h3>
          <ol>${lesson.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          <button type="button" class="secondary-button" data-help-training-start="${escapeHtml(lesson.id)}">Start lesson</button>
          <button type="button" class="secondary-button" data-help-training-complete="${escapeHtml(lesson.id)}">Mark complete</button>
        </article>
      `;
    }).join("");

    return `
      <section class="section help-training">
        ${active ? `<div class="help-training-banner" role="status">Training Mode active — live streaming and recording are not started from training.</div>` : ""}
        <div class="section-heading-row">
          <h2>Training Mode</h2>
          <button type="button" class="action-button" data-command="help-toggle-training">${active ? "Exit Training Mode" : "Enter Training Mode"}</button>
        </div>
        <p class="muted">Practice worship workflows safely with sample content. Real projector output only when you explicitly present during training.</p>
        <div class="help-training-grid">${cards}</div>
      </section>
    `;
  }

  window.CISHelpTraining = { renderTraining };
})();
