import assert from "node:assert/strict";
import {
  buildAggitsVuBandEmail,
  buildAggitsVuConsolidatedCsv,
  buildAggitsVuWeeklyReport,
  isMelbourneFridayFive,
  sendAggitsVuWeeklyReports,
} from "../worker/aggits-jukebox-report.js";

const summaryRows = [
    {
      edition_id: "dc_1111111111",
      band_name: "DOSE",
      updated_at: "2026-08-10T00:00:00.000Z",
      unique_sessions: 12,
      page_views: 18,
      qr_scans: 7,
      coin_inserts: 13,
      outbound_clicks: 9,
      share_actions: 2,
    },
    {
      edition_id: "dc_2222222222",
      band_name: "Ghost, The Band",
      updated_at: "2026-08-10T00:00:00.000Z",
      unique_sessions: 4,
      page_views: 6,
      qr_scans: 1,
      coin_inserts: 5,
      outbound_clicks: 3,
      share_actions: 0,
    },
  ],
  buttonRows = [
    { edition_id: "dc_1111111111", button_name: "Bandcamp", clicks: 5 },
    { edition_id: "dc_1111111111", button_name: "Buy Music", clicks: 4 },
    { edition_id: "dc_2222222222", button_name: "Contact", clicks: 3 },
  ],
  calls = [],
  env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return {
              all: async () => ({
                results: sql.includes("COUNT(DISTINCT CASE")
                  ? summaryRows
                  : buttonRows,
              }),
            };
          },
        };
      },
    },
    RESEND_API_KEY: "test-key",
    REPORT_RECIPIENT: "owner@example.com",
    REPORT_FROM_EMAIL: "reports@example.com",
  },
  now = new Date("2026-08-14T07:00:00.000Z"),
  report = await buildAggitsVuWeeklyReport(env, now, 7);

assert.equal(report.jukeboxes.length, 2);
assert.equal(report.jukeboxes[0].bandName, "DOSE");
assert.equal(report.jukeboxes[0].buttonClicks[0].name, "Bandcamp");
assert.equal(report.jukeboxes[0].buttonClicks[0].clicks, 5);
assert.equal(calls.length, 2);
assert.deepEqual(calls[0].values, [report.periodStart, report.periodEnd]);
assert.match(calls[0].sql, /appearanceVariant/);
assert.match(calls[1].sql, /button_name/);

const email = buildAggitsVuBandEmail(report, report.jukeboxes[0]);
assert.match(email, /DOSE/);
assert.match(email, /Page opens/);
assert.match(email, /Bandcamp/);
assert.match(email, />5</);
const csv = buildAggitsVuConsolidatedCsv(report);
assert.match(csv, /^edition_id,band_name,period_start/);
assert.match(csv, /"Ghost, The Band"/);
assert.match(csv, /"Bandcamp: 5 \| Buy Music: 4"/);

assert.equal(isMelbourneFridayFive(new Date("2026-08-14T07:00:00.000Z")), true);
assert.equal(isMelbourneFridayFive(new Date("2026-01-16T06:00:00.000Z")), true);
assert.equal(isMelbourneFridayFive(new Date("2026-08-14T06:00:00.000Z")), false);
assert.equal(isMelbourneFridayFive(new Date("2026-08-13T07:00:00.000Z")), false);

const sent = [];
const result = await sendAggitsVuWeeklyReports(env, now, async (url, options) => {
  sent.push({ url, options, body: JSON.parse(options.body) });
  return Response.json({ id: `email_${sent.length}` });
});
assert.equal(result.sent, 3);
assert.equal(sent.length, 3);
assert.equal(sent[0].body.to[0], "owner@example.com");
assert.match(sent[0].body.subject, /^DOSE Jukebox weekly activity/);
assert.match(sent[1].body.subject, /^Ghost, The Band Jukebox weekly activity/);
assert.match(sent[2].body.subject, /^All Aggits VU Jukeboxes/);
assert.equal(sent[2].body.attachments[0].filename, "aggits-vu-all-jukeboxes-2026-08-14.csv");
assert.match(Buffer.from(sent[2].body.attachments[0].content, "base64").toString("utf8"), /DOSE/);
assert.match(sent[0].options.headers["idempotency-key"], /dc_1111111111-2026-08-14$/);

console.log("Aggits VU Friday email and consolidated CSV report tests passed.");
