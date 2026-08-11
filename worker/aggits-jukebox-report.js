const DAY_MS = 86_400_000;

export async function buildAggitsVuWeeklyReport(env, now = new Date(), days = 7) {
  const end = new Date(now),
    start = new Date(end.getTime() - Math.max(1, Number(days) || 7) * DAY_MS),
    summary = await env.DB.prepare(`SELECT j.edition_id,j.title band_name,j.updated_at,
      COUNT(DISTINCT CASE WHEN a.session_id IS NOT NULL AND a.session_id<>'' THEN a.session_id END) unique_sessions,
      SUM(CASE WHEN a.event_name='discovery_page_viewed' THEN 1 ELSE 0 END) page_views,
      SUM(CASE WHEN a.event_name='qr_scan' THEN 1 ELSE 0 END) qr_scans,
      SUM(CASE WHEN a.event_name='jookbox_coin_inserted' THEN 1 ELSE 0 END) coin_inserts,
      SUM(CASE WHEN a.event_name='outbound_clicked' THEN 1 ELSE 0 END) outbound_clicks,
      SUM(CASE WHEN a.event_name LIKE 'share_%' OR a.event_name='native_share_completed' THEN 1 ELSE 0 END) share_actions
      FROM aggits_jukebox_editions j
      LEFT JOIN analytics_events a ON a.edition_id=j.edition_id AND a.occurred_at>=?1 AND a.occurred_at<?2
      WHERE j.status='active' AND json_extract(j.config_json,'$.aggitsJukebox.appearanceVariant')='mahogany-vu'
      GROUP BY j.edition_id,j.title,j.updated_at ORDER BY j.title`)
      .bind(start.toISOString(), end.toISOString())
      .all(),
    buttons = await env.DB.prepare(`SELECT a.edition_id,
      COALESCE(NULLIF(json_extract(a.metadata_json,'$.button_name'),''),NULLIF(a.destination_platform,''),'Other') button_name,
      COUNT(*) clicks
      FROM analytics_events a
      JOIN aggits_jukebox_editions j ON j.edition_id=a.edition_id
      WHERE j.status='active' AND json_extract(j.config_json,'$.aggitsJukebox.appearanceVariant')='mahogany-vu'
        AND a.occurred_at>=?1 AND a.occurred_at<?2 AND a.event_name='outbound_clicked'
      GROUP BY a.edition_id,button_name ORDER BY a.edition_id,clicks DESC,button_name`)
      .bind(start.toISOString(), end.toISOString())
      .all(),
    byEdition = new Map();
  for (const button of buttons.results || []) {
    const rows = byEdition.get(button.edition_id) || [];
    rows.push({ name: clean(button.button_name, 80), clicks: Number(button.clicks) || 0 });
    byEdition.set(button.edition_id, rows);
  }
  return {
    generatedAt: end.toISOString(),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    periodLabel: periodLabel(start, end),
    jukeboxes: (summary.results || []).map((row) => ({
      editionId: row.edition_id,
      bandName: row.band_name,
      updatedAt: row.updated_at,
      uniqueSessions: Number(row.unique_sessions) || 0,
      pageViews: Number(row.page_views) || 0,
      qrScans: Number(row.qr_scans) || 0,
      coinInserts: Number(row.coin_inserts) || 0,
      outboundClicks: Number(row.outbound_clicks) || 0,
      shareActions: Number(row.share_actions) || 0,
      buttonClicks: byEdition.get(row.edition_id) || [],
    })),
  };
}

export function isMelbourneFridayFive(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(now)),
    weekday = parts.find((item) => item.type === "weekday")?.value,
    hour = Number(parts.find((item) => item.type === "hour")?.value);
  return weekday === "Fri" && hour === 17;
}

export function buildAggitsVuBandEmail(report, jukebox) {
  const buttons = jukebox.buttonClicks.length
      ? jukebox.buttonClicks
          .map((button) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eadfc9">${escapeHtml(button.name)}</td><td style="padding:8px 10px;border-bottom:1px solid #eadfc9;text-align:right"><strong>${button.clicks}</strong></td></tr>`)
          .join("")
      : '<tr><td colspan="2" style="padding:10px;color:#6f6559">No destination buttons were clicked this week.</td></tr>',
    metric = (label, value) => `<td style="width:33%;padding:12px 8px;border:1px solid #d8bf90;text-align:center"><div style="font:700 24px Georgia,serif;color:#704319">${value}</div><div style="font:700 10px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6f6559">${label}</div></td>`;
  return `<!doctype html><html><body style="margin:0;background:#f4eee3;color:#21180f;font-family:Arial,sans-serif"><main style="max-width:680px;margin:auto;padding:26px"><section style="border:1px solid #9d7543;background:#fffaf1;padding:24px"><div style="color:#9a6428;font-size:11px;font-weight:800;letter-spacing:.16em">AGGITS JUKEBOX · WEEKLY ACTIVITY</div><h1 style="margin:8px 0 4px;font:700 32px Georgia,serif">${escapeHtml(jukebox.bandName)}</h1><p style="margin:0 0 18px;color:#6f6559">${escapeHtml(report.periodLabel)}</p><table style="width:100%;border-collapse:collapse"><tr>${metric("Page opens", jukebox.pageViews)}${metric("QR scans", jukebox.qrScans)}${metric("Coin starts", jukebox.coinInserts)}</tr><tr>${metric("Unique visitors", jukebox.uniqueSessions)}${metric("Button clicks", jukebox.outboundClicks)}${metric("Shares", jukebox.shareActions)}</tr></table><h2 style="margin:24px 0 6px;font:700 18px Georgia,serif">Destination button activity</h2><table style="width:100%;border-collapse:collapse;background:#fff">${buttons}</table><p style="margin:22px 0 0;color:#827668;font-size:11px;line-height:1.5">Counts describe activity recorded by this live jukebox during the reporting period. A destination click does not claim a stream, follow, purchase or sale.</p></section></main></body></html>`;
}

export function buildAggitsVuConsolidatedCsv(report) {
  const rows = report.jukeboxes.map((jukebox) => ({
    edition_id: jukebox.editionId,
    band_name: jukebox.bandName,
    period_start: report.periodStart,
    period_end: report.periodEnd,
    unique_visitors: jukebox.uniqueSessions,
    page_opens: jukebox.pageViews,
    qr_scans: jukebox.qrScans,
    coin_starts: jukebox.coinInserts,
    destination_clicks: jukebox.outboundClicks,
    shares: jukebox.shareActions,
    button_breakdown: jukebox.buttonClicks.map((item) => `${item.name}: ${item.clicks}`).join(" | "),
  }));
  const columns = ["edition_id","band_name","period_start","period_end","unique_visitors","page_opens","qr_scans","coin_starts","destination_clicks","shares","button_breakdown"];
  return [columns.join(","), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n") + "\r\n";
}

export async function sendAggitsVuWeeklyReports(env, now = new Date(), fetchImpl = fetch) {
  if (!env.RESEND_API_KEY || !env.REPORT_RECIPIENT || !env.REPORT_FROM_EMAIL)
    return { sent: 0, skipped: "email_not_configured" };
  const report = await buildAggitsVuWeeklyReport(env, now, 7),
    stamp = now.toISOString().slice(0, 10);
  if (!report.jukeboxes.length) return { sent: 0, report };
  for (const jukebox of report.jukeboxes) {
    await sendEmail(fetchImpl, env, {
      key: `aggits-vu-weekly-${jukebox.editionId}-${stamp}`,
      subject: `${jukebox.bandName} Jukebox weekly activity — ${report.periodLabel}`,
      html: buildAggitsVuBandEmail(report, jukebox),
      tags: [{ name: "report", value: "aggits_vu_band" }, { name: "edition", value: jukebox.editionId.slice(0, 40) }],
    });
  }
  const csv = buildAggitsVuConsolidatedCsv(report);
  await sendEmail(fetchImpl, env, {
    key: `aggits-vu-consolidated-${stamp}`,
    subject: `All Aggits VU Jukeboxes — weekly consolidated activity — ${report.periodLabel}`,
    html: `<p><strong>${report.jukeboxes.length}</strong> live VU jukebox${report.jukeboxes.length === 1 ? "" : "es"} are included for ${escapeHtml(report.periodLabel)}.</p><p>The attached CSV contains the combined totals and per-button breakdown for every live band jukebox.</p>`,
    attachments: [{ content: base64(csv), filename: `aggits-vu-all-jukeboxes-${stamp}.csv` }],
    tags: [{ name: "report", value: "aggits_vu_all" }, { name: "report_date", value: stamp }],
  });
  return { sent: report.jukeboxes.length + 1, report };
}

async function sendEmail(fetchImpl, env, message) {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": message.key },
    body: JSON.stringify({ from: env.REPORT_FROM_EMAIL, to: [env.REPORT_RECIPIENT], subject: message.subject, html: message.html, attachments: message.attachments || [], tags: message.tags || [] }),
  });
  if (!response.ok) throw new Error(`Aggits VU weekly report email was rejected (${response.status}): ${await response.text()}`);
}

function periodLabel(start, end) {
  const format = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric" });
  return `${format.format(start)} – ${format.format(end)}`;
}
function clean(value, max = 200) { return String(value || "").trim().slice(0, max); }
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function base64(text) { const bytes = new TextEncoder().encode(text); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
