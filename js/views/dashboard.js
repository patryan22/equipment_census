import { getAll, getSetting } from '../db.js';
import { esc, fmtDate } from '../util.js';
import { isBobcat, isOpportunity, countBy, ageBucket, AGE_BUCKETS, customerStats, titleOf, DEFAULT_AGE_THRESHOLD, OPEN_STATUSES } from '../insights.js';

const q = (o) => '#/equipment?' + new URLSearchParams(o).toString();

function bars(items, total, hrefFn, cls = '') {
  const max = Math.max(1, ...items.map((i) => i[1]));
  return `<div class="bars">${items.map(([label, n, key]) => `
    <a href="${hrefFn(key ?? label)}"><div class="lbl"><span>${esc(label)}</span><span>${n} <span class="muted">· ${Math.round((n / total) * 100)}%</span></span></div>
    <div class="track"><div class="fill ${/^Bobcat$/i.test(label) ? 'bobcat' : cls}" style="width:${(n / max) * 100}%"></div></div></a>`).join('')}</div>`;
}

export async function render(el) {
  const [equipment, customers, threshold] = await Promise.all([getAll('equipment'), getAll('customers'), getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD)]);
  if (!equipment.length) { el.innerHTML = '<div class="empty"><div style="font-size:48px">📊</div>Insights appear once you have logged some equipment.</div>'; return; }

  const total = equipment.length;
  const bobcat = equipment.filter(isBobcat).length;
  const opps = equipment.filter((e) => isOpportunity(e, threshold));
  const stats = [...customerStats(customers, equipment).values()];
  const noBobcat = stats.filter((s) => s.total && !s.bobcat).length;
  const cname = new Map(customers.map((c) => [c.id, c.name]));

  const brands = countBy(equipment, (e) => e.brand || 'Unknown').slice(0, 10).map(([k, n]) => [k, n]);
  const types = countBy(equipment, (e) => e.category).map(([k, n]) => [k, n]);
  const counties = countBy(equipment, (e) => e.county).map(([k, n]) => [k, n]);
  const ageCounts = AGE_BUCKETS.map(([key, label]) => [label, equipment.filter((e) => ageBucket(e) === key).length, key]).filter((x) => x[1]);
  const top = stats.filter((s) => s.total).sort((a, b) => b.total - a.total).slice(0, 8);
  const pipeline = OPEN_STATUSES.map((s) => [s, equipment.filter((e) => e.status === s).length]).filter((x) => x[1]);
  const followUps = equipment.filter((e) => e.followUp && e.status !== 'Won' && e.status !== 'Lost').sort((a, b) => a.followUp.localeCompare(b.followUp)).slice(0, 6);
  const oldest = opps.slice().sort((a, b) => (a.year || 9999) - (b.year || 9999)).slice(0, 8);

  el.innerHTML = `
    <div class="kpis">
      <a class="kpi" href="#/equipment"><b>${total}</b><span>machines · ${customers.length} customers</span></a>
      <a class="kpi" href="${q({ who: 'bobcat' })}"><b style="color:var(--bobcat)">${Math.round((bobcat / total) * 100)}%</b><span>Bobcat share (${bobcat} of ${total})</span></a>
      <a class="kpi" href="${q({ opp: '1' })}"><b style="color:var(--bad)">${opps.length}</b><span>sales opportunities</span></a>
      <a class="kpi" href="#/customers"><b>${noBobcat}</b><span>customers with no Bobcat</span></a>
    </div>

    <h2>Best opportunities (oldest competitor machines)</h2>
    <div class="card">${oldest.length ? oldest.map((e) => `<a href="#/equipment/${e.id}" style="display:block;color:var(--text);padding:6px 0"><b>${esc(titleOf(e))}</b>
      <div class="small muted">${esc(cname.get(e.customerId) || 'No customer')}${e.county ? ' · ' + esc(e.county) : ''}</div></a>`).join('') : `<span class="muted small">None flagged. Machines ${threshold}+ years old from other brands show up here (change in Settings).</span>`}
      ${opps.length > oldest.length ? `<a class="small" href="${q({ opp: '1', sort: 'oldest' })}">See all ${opps.length} →</a>` : ''}</div>

    ${followUps.length ? `<h2>Upcoming follow-ups</h2><div class="card">${followUps.map((e) => `<a href="#/equipment/${e.id}" style="display:block;color:var(--text);padding:6px 0">
      <b>${fmtDate(e.followUp + 'T12:00:00')}</b> · ${esc(titleOf(e))}<div class="small muted">${esc(cname.get(e.customerId) || 'No customer')}</div></a>`).join('')}</div>` : ''}

    ${pipeline.length ? `<h2>Pipeline</h2><div class="card">${bars(pipeline, Math.max(1, pipeline.reduce((a, b) => a + b[1], 0)), (k) => q({ status: k }), 'bad')}</div>` : ''}
    <h2>By brand</h2><div class="card">${bars(brands, total, (k) => q({ brand: k === 'Unknown' ? '' : k }))}</div>
    ${types.length ? `<h2>By equipment type</h2><div class="card">${bars(types, total, (k) => q({ type: k }))}</div>` : ''}
    ${counties.length ? `<h2>By county</h2><div class="card">${bars(counties, total, (k) => q({ county: k }))}</div>` : ''}
    <h2>Age of fleet</h2><div class="card">${bars(ageCounts, total, (k) => q({ age: k }))}</div>
    <h2>Largest fleets</h2><div class="card">${top.map((s) => `<a href="#/customers/${s.c.id}" style="display:flex;justify-content:space-between;color:var(--text);padding:6px 0">
      <span>${esc(s.c.name)}</span><span class="muted">${s.total} · ${s.bobcat} Bobcat</span></a>`).join('')}</div>`;
}
