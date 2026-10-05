// Renders the "Seder & regler" (Customs & Rules) view from data/customs.json
(function () {
  let rendered = false;

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderGroup(section) {
    const items = section.items
      .map((item) => {
        const hanziBit = item.hanzi
          ? `<span class="ci-hanzi zh">${esc(item.hanzi)}</span>`
          : '';
        return `
        <div class="customs-item">
          <div class="ci-head">
            <h3>${esc(item.title_sv)}</h3>
            ${hanziBit}
          </div>
          <p>${esc(item.text_sv)}</p>
        </div>`;
      })
      .join('');

    const noteBit = section.note_sv
      ? `<p class="customs-note">${esc(section.note_sv)}</p>`
      : '';

    return `
    <details class="customs-group" ${section.id === 'klanregler' ? 'open' : ''}>
      <summary>
        <div class="cg-title-block">
          <h2>${esc(section.title_sv)} <span class="zh cg-hanzi">${esc(section.hanzi)}</span></h2>
          <p class="cg-subtitle">${esc(section.subtitle_sv)}</p>
        </div>
        <span class="cg-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="cg-body">
        ${noteBit}
        <div class="customs-item-grid">${items}</div>
      </div>
    </details>`;
  }

  function render() {
    if (rendered) return;
    const data = window.App.state.customs;
    if (!data) return;
    document.getElementById('customs-intro-text').textContent = data.intro;
    document.getElementById('customs-groups').innerHTML = data.sections.map(renderGroup).join('');
    document.getElementById('customs-source').textContent = data.source_note;
    rendered = true;
  }

  window.addEventListener('dataready', render);
  window.addEventListener('viewchange', (e) => {
    if (e.detail === 'customs') render();
  });
})();
