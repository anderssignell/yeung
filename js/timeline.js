(function () {
  function render() {
    if (window.Unified && App.state.unified) Unified.build(App.state.unified);
    const track = document.getElementById('timeline-track');
    const items = [...App.state.timeline].sort((a, b) => a.year - b.year);
    track.innerHTML = items
      .map((item) => {
        const place = App.state.placesById[item.place_id];
        const placeBtn = place
          ? `<button class="timeline-place-link" data-place="${item.place_id}">📍 ${Unified.esc(I18n.dt(place.name).split(' – ')[0])} — ${I18n.t('tl_on_map')}</button>`
          : '';
        const people = (item.persons || [])
          .map((id) => {
            const r = window.Unified && Unified.idx.byId[id];
            return r ? `<button class="timeline-person-link" data-person="${id}">${Unified.esc(Unified.displayName(r))}</button>` : '';
          })
          .join('');
        const peopleHtml = people ? `<div class="timeline-people"><span class="timeline-people-label">${I18n.t('tl_in_tree')}</span>${people}</div>` : '';
        return `
        <div class="timeline-item">
          <div class="timeline-card">
            <div class="timeline-era">${I18n.dt(item.era)}</div>
            <div class="timeline-year">${item.year}${item.approx ? `<span class="approx-tag">${I18n.t('approx')}</span>` : ''}</div>
            <h3>${I18n.dt(item.title)}</h3>
            <p>${I18n.dt(item.text)}</p>
            ${peopleHtml}
            ${placeBtn}
          </div>
        </div>`;
      })
      .join('');

    track.querySelectorAll('.timeline-place-link').forEach((btn) => {
      btn.addEventListener('click', () => Unified.showPlace(btn.dataset.place));
    });
    track.querySelectorAll('.timeline-person-link').forEach((btn) => {
      btn.addEventListener('click', () => Unified.showPerson(btn.dataset.person));
    });
  }

  window.addEventListener('dataready', render);
  window.addEventListener('langchange', () => App.state.timeline.length && render());
})();
