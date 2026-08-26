from pathlib import Path
import re

root = Path('.')


def read(path):
    return (root / path).read_text()


def write(path, content):
    (root / path).write_text(content)


def replace_once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)


# First paint: Vocabulary owns its sidebar mount directly. No Scratchpad markup is rendered.
path = 'src/pages/dashboard/index.html'
source = read(path)
old = '''        <section class="scratchpad" aria-labelledby="scratchpad-title">
          <div class="scratchpad-heading"><p id="scratchpad-title">Scratchpad</p><span id="scratchpad-status">Local</span></div>
          <label class="sr-only" for="scratchpad-input">Quick personal notes</label>
          <textarea id="scratchpad-input" placeholder="Drop a thought here…" spellcheck="true"></textarea>
        </section>'''
new = '''        <section class="vocabulary-widget" aria-label="Vocabulary flashcards" data-vocabulary-widget>
          <div data-vocab-practice-root="desktop"></div>
        </section>'''
source = replace_once(source, old, new, 'dashboard Scratchpad markup')
write(path, source)

# Vocabulary no longer repurposes a Scratchpad node at runtime.
path = 'project-data/vocabulary/vocabulary.js'
source = read(path)
source = replace_once(
    source,
    '''  const scratchpad = document.querySelector(".scratchpad");
  if (!scratchpad) return;''',
    '''  const vocabularyWidget = document.querySelector("[data-vocabulary-widget]");
  if (!vocabularyWidget) return;''',
    'Vocabulary mount lookup',
)
source = replace_once(
    source,
    '''  scratchpad.className = "vocabulary-widget";
  scratchpad.setAttribute("aria-label", "Vocabulary flashcards");
  scratchpad.innerHTML = '<div data-vocab-practice-root="desktop"></div>';

''',
    '',
    'Vocabulary Scratchpad conversion',
)
source = replace_once(
    source,
    ': scratchpad.querySelector("[data-vocab-practice-root]");',
    ': vocabularyWidget.querySelector("[data-vocab-practice-root]");',
    'Vocabulary active desktop root',
)
if re.search(r'\bscratchpad\b', source, re.I):
    raise SystemExit('Vocabulary runtime still contains a Scratchpad reference')
write(path, source)

# Remove Scratchpad state, timers and DOM handles from the dashboard core.
path = 'src/pages/dashboard/app-state.js'
source = read(path)
for old in [
    'const SCRATCHPAD_KEY = "joy-dashboard-scratchpad";\n',
    'const SCRATCHPAD_META_KEY = "joy-dashboard-scratchpad-cloud-meta-v1";\n',
    'const SCRATCHPAD_CONFLICT_BACKUP_KEY = "joy-dashboard-scratchpad-conflict-backup-v1";\n',
    '  scratchpadVersion: 0,\n',
    '  scratchpadUpdatedAt: 0,\n',
    '  scratchpadReady: false,\n',
    '  scratchpadSaving: false,\n',
    'let scratchSaveTimer;\n',
    '  scratchpad: document.querySelector("#scratchpad-input"),\n',
    '  scratchpadStatus: document.querySelector("#scratchpad-status"),\n',
]:
    if old not in source:
        raise SystemExit(f'app-state missing expected Scratchpad fragment: {old.strip()}')
    source = source.replace(old, '', 1)
write(path, source)

# Remove Scratchpad listeners/startup/visibility sync.
path = 'src/pages/dashboard/app-bootstrap.js'
source = read(path)
for old in [
    'elements.scratchpad.addEventListener("input", queueScratchpadSave);\n\n',
    'loadScratchpad();\n',
    '    if (accountSync.connected) syncCloudScratchpad({ silent: true });\n',
]:
    source = replace_once(source, old, '', f'app-bootstrap {old.strip()}')
write(path, source)

# Remove Scratchpad coupling from Gmail/session lifecycle.
path = 'src/pages/dashboard/app-integrations.js'
source = read(path)
for old in [
    '      elements.scratchpadStatus.textContent = "Local";\n',
    '    await syncCloudScratchpad();\n',
    '      accountSync.scratchpadReady = false;\n',
]:
    source = replace_once(source, old, '', f'app-integrations {old.strip()}')
old = '      elements.scratchpadStatus.textContent = "Local";\n'
if old in source:
    source = source.replace(old, '', 1)
write(path, source)

# Dashboard bundle/test source ownership no longer includes app-scratchpad.js.
for path, old in [
    ('scripts/build.mjs', '  "app-scratchpad.js",\n'),
    ('scripts/run-tests.mjs', '  "src/pages/dashboard/app-scratchpad.js",\n'),
]:
    source = read(path)
    source = replace_once(source, old, '', f'{path} Scratchpad module')
    write(path, source)

# Account sync is now projects-only.
path = 'worker/account-sync.js'
source = read(path)
source = replace_once(source, 'const MAX_SCRATCHPAD_LENGTH = 100_000;\n', '', 'Scratchpad max length')
start = source.find('export function normalizeScratchpadInput')
end = source.find('export function normalizeProjectInput')
if start < 0 or end < 0 or end <= start:
    raise SystemExit('Could not isolate Scratchpad helpers in account-sync.js')
source = source[:start] + source[end:]
write(path, source)

# Retire authenticated Scratchpad API while preserving projects/tasks.
path = 'worker/dashboard-data.js'
source = read(path)
source = replace_once(
    source,
    '''import {
  normalizeProjectInput,
  normalizeScratchpadInput,
  projectRowToApi,
  scratchpadRowToApi,
} from "./account-sync.js";''',
    '''import {
  normalizeProjectInput,
  projectRowToApi,
} from "./account-sync.js";''',
    'dashboard-data imports',
)
source = replace_once(source, '  "/api/scratchpad",\n', '', 'Scratchpad route registration')
source = replace_once(source, '  if (url.pathname === "/api/scratchpad" && request.method === "GET") return getScratchpad(email, env);\n', '', 'Scratchpad GET route')
source = replace_once(source, '  if (url.pathname === "/api/scratchpad" && request.method === "PUT") return updateScratchpad(request, email, env);\n', '', 'Scratchpad PUT route')
start = source.find('\nasync function getScratchpad(')
if start < 0:
    raise SystemExit('Scratchpad worker handlers not found')
source = source[:start].rstrip() + '\n'
write(path, source)

# Remove dead Scratchpad presentation rules from the base stylesheet.
path = 'src/pages/dashboard/styles.css'
source = read(path)
source = source.replace('/* Hey Joy sidebar: icon-only navigation and a local scratchpad */', '/* Hey Joy sidebar: icon-only navigation */', 1)
start = source.find('.scratchpad {\n')
end = source.find('.sidebar-footer {', start)
if start < 0 or end < 0:
    raise SystemExit('Scratchpad CSS block not found')
source = source[:start] + source[end:]
source = source.replace('  .scratchpad { min-height: 190px; }\n  .scratchpad textarea { min-height: 135px; }\n', '', 1)
write(path, source)

# Update ownership tests and add a first-paint/runtime retirement contract.
path = 'test/dashboard-module-ownership.test.mjs'
source = read(path)
source = replace_once(source, '  "src/pages/dashboard/app-scratchpad.js",\n', '', 'module ownership list')
start = source.find('test("Scratchpad lifecycle has one frontend owner"')
end = source.find('test("generated dashboard bundle retains key runtime contracts"', start)
if start < 0 or end < 0:
    raise SystemExit('Scratchpad ownership test block not found')
replacement = '''test("retired Scratchpad does not participate in dashboard runtime", async () => {
  const [html, state, integrations, bootstrap, worker, accountSync, styles, vocabulary] = await Promise.all([
    read("src/pages/dashboard/index.html"),
    read("src/pages/dashboard/app-state.js"),
    read("src/pages/dashboard/app-integrations.js"),
    read("src/pages/dashboard/app-bootstrap.js"),
    read("worker/dashboard-data.js"),
    read("worker/account-sync.js"),
    read("src/pages/dashboard/styles.css"),
    read("project-data/vocabulary/vocabulary.js"),
  ]);

  assert.match(html, /data-vocabulary-widget/);
  assert.match(html, /data-vocab-practice-root="desktop"/);
  for (const [label, runtime] of Object.entries({ html, state, integrations, bootstrap, worker, accountSync, styles, vocabulary })) {
    assert.doesNotMatch(runtime, /scratchpad/i, `Scratchpad leaked into ${label}`);
  }
});

'''
source = source[:start] + replacement + source[end:]
write(path, source)

# Dedicated Scratchpad files/tests are obsolete.
for obsolete in [
    'src/pages/dashboard/app-scratchpad.js',
    'test/scratchpad-sync.test.mjs',
]:
    target = root / obsolete
    if not target.exists():
        raise SystemExit(f'Expected obsolete file missing: {obsolete}')
    target.unlink()

# Guard the intended scope: runtime directories must no longer reference Scratchpad.
runtime_files = [
    root / 'src/pages/dashboard/index.html',
    root / 'src/pages/dashboard/app-state.js',
    root / 'src/pages/dashboard/app-integrations.js',
    root / 'src/pages/dashboard/app-bootstrap.js',
    root / 'src/pages/dashboard/styles.css',
    root / 'project-data/vocabulary/vocabulary.js',
    root / 'worker/account-sync.js',
    root / 'worker/dashboard-data.js',
    root / 'scripts/build.mjs',
    root / 'scripts/run-tests.mjs',
]
leaks = [str(p) for p in runtime_files if re.search(r'scratchpad', p.read_text(), re.I)]
if leaks:
    raise SystemExit('Scratchpad runtime references remain: ' + ', '.join(leaks))

# One-time helper files must not remain in the product branch.
for helper in [
    root / '.github/workflows/scratchpad-runtime-cleanup.yml',
    root / 'scripts/remove-scratchpad-runtime.py',
]:
    if helper.exists():
        helper.unlink()
