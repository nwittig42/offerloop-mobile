// Scout routing battery — run: node scripts/scout-battery.mjs
// (wraps the parser layers from scoutActions.ts; every utterance must land on
// a named outcome, never a silent dead-end. Exits non-zero when a fixture
// with an expectation regresses.)
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const src = readFileSync(new URL('../src/api/endpoints/scoutActions.ts', import.meta.url), 'utf8');
const a = src.indexOf('const ASR_FIXES');
const b = src.indexOf('/** One clarify round');
if (a < 0 || b < 0 || b < a) throw new Error('battery slice markers moved in scoutActions.ts — fix the markers, not the battery');
let body = src.slice(a, b).replace(/export function/g, 'function').replace(/export type/g, 'type');
body = body.replace('function matchJobs(jobs: Job[]', 'function matchJobs(jobs: any[]');

const harness = body + `
// Mirrors submitAsk's ladder order (index.tsx), including the voice-overhaul
// P1 rule: voice asks that don't parse to an exact-known company consult the
// server brain, whose canonical result re-enters the same gates.
const route = (ask) => {
  const aff = parseAffirmation(ask);
  if (aff) return 'AFFIRM:' + aff + ' (drives pending card / stands down)';
  if (parseAgain(ask)) return 'AGAIN (re-runs last, confirmed)';
  const nav = parseNav(ask);
  if (nav) return 'NAV → ' + nav.label;
  const n = normalizeAsk(ask);
  const i = parseIntent(n.text);
  if (!isHighConfidenceParse(i, [])) {
    if (!i) return 'SERVER (unparsed) → classify; chat/refine on failure';
    return 'SERVER (low-confidence voice) → classify; gates re-apply on re-entry';
  }
  if (i.kind === 'find_people') return 'PREVIEW ' + (i.role || 'people') + ' @ ' + i.company + (i.location ? ' in ' + i.location : '');
  if (i.kind === 'find_jobs') return 'JOBS q="' + i.query + '"';
  if (i.kind === 'apply_saved') return 'APPLY (scope receipt)';
  if (i.kind === 'prep') return 'PREP';
  const gate = !i.company ? 'clarify' : 'gates→run';
  return 'DRAFT ' + i.count + 'x "' + i.role + '" @ ' + (i.company ?? '?') + ' [' + gate + ']';
};
// [utterance, expected-prefix | null (print-only)]
const battery = [
  // confirmations & control
  ['yes', 'AFFIRM'], ['yeah go ahead', 'AFFIRM'], ['run it', 'AFFIRM'],
  ['no cancel that', 'AFFIRM'], ['never mind', 'AFFIRM'], ['stop', 'AFFIRM'],
  // 'do it again' reads as AFFIRM here; in-app it only confirms when a card
  // is pending, else falls through to AGAIN — the flat model can't assert it.
  ['again', 'AGAIN'], ['one more', 'AGAIN'], ['do it again', null],
  // navigation
  ['open my inbox', 'NAV'], ['check my replies', 'NAV'],
  ['where are my saved jobs', 'NAV'], ['go to my network', 'NAV'],
  ['show my credits', 'NAV'], ['open notifications', 'NAV'],
  ['take me to my profile', 'NAV'],
  // bare fragments
  ['Goldman Sachs', null], ['Stripe', null], ['hiring managers', 'SERVER'],
  ['IB analysts in LA', 'SERVER'], ['consultants', 'SERVER'],
  // core intents — exact-known companies stay LOCAL and instant
  ['Draft 3 IB analysts at Goldman Sachs', 'DRAFT'],
  ['Find one hiring manager at Stripe', 'DRAFT'],
  ['show me people at Bain in LA', 'PREVIEW'],
  ['people at Evercore', null], ['who works at Meta', 'PREVIEW'],
  ['analysts at Blackstone in New York', null],
  // The can't-miss chip phrasing (industry-aware variants, 2026-07-09) must
  // parse as a draft at the named firm — it's on every coach/refine card.
  ['Draft someone on the team at Moelis', 'DRAFT'],
  ['find me a pm role to apply to', 'JOBS'],
  ['apply to my saved jobs', 'APPLY'],
  ['prep me for my 2pm', 'PREP'],
  // field-observed mishears (2026-07-08 walk) — must reach the SERVER brain
  // or a named local gate; NEVER a silent wrong-company run.
  // Fix-map rescues Molly's→Moelis BEFORE parse (silent tier-1 win, correct
  // firm). If the fix-map regex ever retires, this becomes SERVER — both fine.
  ["Find me two analysts at Molly's", null],
  ['find analysts at Molise', null],                    // fix-map may rescue silently — either SERVER or PREVIEW @ Moelis
  ['Draft one analyst at Mose', 'SERVER'],
  ['reach out to someone at mo ellis', null],
  ['You have two analyst set Evercore', 'SERVER'],
  ['Evercore please', null], ['at Please', null],
  ['manners at goldman sex', null], ['recruiter at stipe', 'SERVER'],
  ['Blah blah at Goldman Sachs', null],
  // questions (must stay conversational — routed via server classify now)
  ['what should I say in a follow up email', 'SERVER'],
  ['how do I network into MBB', 'SERVER'],
  ['are managers usually nice', 'SERVER'],
  ['what can you do', 'SERVER'],
  // odd but must not dead-end
  ['hello', null], ['thanks scout', null],
  ['draft 20 analysts at Google', 'DRAFT'], ['asdf ghjk', 'SERVER'],
];
let out = '';
let failures = 0;
for (const [t, want] of battery) {
  const got = route(t);
  const ok = want == null || got.startsWith(want);
  if (!ok) failures++;
  out += (ok ? '   ' : 'X  ') + JSON.stringify(t).padEnd(60) + ' -> ' + got
       + (ok ? '' : '   [WANT ' + want + ']') + String.fromCharCode(10);
}
out += failures ? String.fromCharCode(10) + 'FAILURES: ' + failures : String.fromCharCode(10) + 'ALL EXPECTATIONS PASS';
console.log(out);
if (failures) process.exit(1);
`;
writeFileSync('/tmp/scout-battery-run.ts', harness);
const r = spawnSync('node', ['--experimental-strip-types', '/tmp/scout-battery-run.ts'], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status ?? 0);
