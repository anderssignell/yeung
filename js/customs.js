// Renders the "Seder & regler" (Customs & Rules) view from data/customs.json
(function () {
  let rendered = false;
  let open = new Set(['klanregler']); // utfällda avsnitt behålls vid språkbyte

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderGroup(section) {
    const items = section.items
      .map((item) => {
        const hanziBit = item.hanzi && item.hanzi !== I18n.dt(item.title_sv)
          ? `<span class="ci-hanzi zh">${esc(item.hanzi)}</span>`
          : '';
        return `
        <div class="customs-item">
          <div class="ci-head">
            <h3>${esc(I18n.dt(item.title_sv))}</h3>
            ${hanziBit}
          </div>
          <p>${esc(I18n.dt(item.text_sv))}</p>
        </div>`;
      })
      .join('');

    const noteBit = section.note_sv
      ? `<p class="customs-note">${esc(I18n.dt(section.note_sv))}</p>`
      : '';

    return `
    <details class="customs-group" data-section="${esc(section.id)}" ${open.has(section.id) ? 'open' : ''}>
      <summary>
        <div class="cg-title-block">
          <h2>${esc(I18n.dt(section.title_sv))}${section.hanzi && section.hanzi !== I18n.dt(section.title_sv) ? ` <span class="zh cg-hanzi">${esc(section.hanzi)}</span>` : ''}</h2>
          <p class="cg-subtitle">${esc(I18n.dt(section.subtitle_sv))}</p>
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
    document.getElementById('customs-intro-text').textContent = I18n.dt(data.intro);
    document.getElementById('customs-groups').innerHTML = data.sections.map(renderGroup).join('');
    const src = document.getElementById('customs-source');
    src.textContent = I18n.dt(data.source_note) + ' ';
    src.insertAdjacentHTML('beforeend', App.bookLink());
    rendered = true;
  }

  window.addEventListener('dataready', render);
  window.addEventListener('langchange', () => {
    if (!rendered) return;
    open = new Set([...document.querySelectorAll('.customs-group[open]')].map((d) => d.dataset.section));
    rendered = false;
    render();
  });
  window.addEventListener('viewchange', (e) => {
    if (e.detail === 'customs') render();
  });
})();
