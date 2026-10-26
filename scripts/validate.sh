#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node personalisation/generate.js --check
node personalisation/test-apply.js
node personalisation/test-guard.js
cd glasshouse
npm run typecheck
node test/run-all.js
python3 scripts/check-es5.py
python3 scripts/check-ui-ids.py
python3 scripts/check-module-calls.py
python3 scripts/check-strings.py
python3 scripts/check-screensavers.py
python3 scripts/check-drift.py
python3 scripts/check-entities.py --stats test/fixtures/stats-b8-webos4.json
python3 - <<'PY'
import importlib.util, tempfile, pathlib
spec = importlib.util.spec_from_file_location('build', 'scripts/build-ipk.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
with tempfile.TemporaryDirectory(prefix='glasshouse-package-') as tmp:
    build.stage(tmp, build.version())
    assert (pathlib.Path(tmp) / 'payload' / 'server' / 'assets' / 'home.html').exists()
    assert not list(pathlib.Path(tmp).rglob('config.json'))
    assert (pathlib.Path(tmp) / 'payload' / 'server' / 'LICENSE').read_bytes() == pathlib.Path('LICENSE').read_bytes()
    for name in ('immich-logo.svg', 'LICENSE-AGPL-3.0.txt', 'NOTICE.txt'):
        relative = pathlib.Path('assets/third-party/immich') / name
        assert (pathlib.Path(tmp) / 'payload' / 'server' / relative).read_bytes() == (pathlib.Path('server') / relative).read_bytes()
print('Package staging passed (no TV access, no IPK signing).')
PY
