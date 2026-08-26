from pathlib import Path

path = Path("scripts/remove-scratchpad-runtime.py")
source = path.read_text()
old = '''for old in [
    '      elements.scratchpadStatus.textContent = "Local";\\n',
    '    await syncCloudScratchpad();\\n',
    '      accountSync.scratchpadReady = false;\\n',
]:
    source = replace_once(source, old, '', f'app-integrations {old.strip()}')
old = '      elements.scratchpadStatus.textContent = "Local";\\n'
if old in source:
    source = source.replace(old, '', 1)
'''
new = '''old = '      elements.scratchpadStatus.textContent = "Local";\\n'
if source.count(old) != 2:
    raise SystemExit(f'app-integrations Scratchpad status: expected 2 matches, found {source.count(old)}')
source = source.replace(old, '')
for old in [
    '    await syncCloudScratchpad();\\n',
    '      accountSync.scratchpadReady = false;\\n',
]:
    source = replace_once(source, old, '', f'app-integrations {old.strip()}')
'''
if old not in source:
    raise SystemExit("Expected integration cleanup block was not found")
path.write_text(source.replace(old, new, 1))
