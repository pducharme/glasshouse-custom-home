#!/usr/bin/env bash
#
# Run a local Prometheus server to scrape one or more Glasshouse TVs.
#
# Usage:
#   ./scripts/run-prometheus.sh <tv-ip> [<tv-ip2> ...]
#
# Examples:
#   ./scripts/run-prometheus.sh 192.168.1.131
#   ./scripts/run-prometheus.sh 192.168.1.131 192.168.1.134
#
# If prometheus is not installed, it downloads the standalone binary into
# ~/.cache/glasshouse-prometheus/ (no root or brew required).

set -e

if [ $# -eq 0 ]; then
  echo "Usage: $0 <tv-ip> [<tv-ip2> ...]" >&2
  echo "  <tv-ip> is the IP of your LG TV running Glasshouse." >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  $0 192.168.1.131 192.168.1.134" >&2
  exit 1
fi

TVS=("$@")
PROM_BIN=""

if command -v prometheus >/dev/null 2>&1; then
  PROM_BIN="prometheus"
else
  CACHE_DIR="${HOME}/.cache/glasshouse-prometheus"
  mkdir -p "$CACHE_DIR"
  PROM_BIN="${CACHE_DIR}/prometheus"

  if [ ! -x "$PROM_BIN" ]; then
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64) ARCH="amd64" ;;
      arm64|aarch64) ARCH="arm64" ;;
      *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
    esac

    VERSION="2.54.1"
    URL="https://github.com/prometheus/prometheus/releases/download/v${VERSION}/prometheus-${VERSION}.${OS}-${ARCH}.tar.gz"
    echo "Prometheus not found in PATH. Downloading standalone v${VERSION} for ${OS}/${ARCH}..."
    curl -sL "$URL" | tar -xz -C "$CACHE_DIR" --strip-components=1
    chmod +x "$PROM_BIN" "${CACHE_DIR}/promtool" 2>/dev/null || true
  fi
fi

RUN_DIR=$(mktemp -d /tmp/glasshouse-prom-XXXXXX)
trap 'rm -rf "$RUN_DIR"' EXIT INT TERM

CONFIG="${RUN_DIR}/prometheus.yml"
DATA_DIR="${RUN_DIR}/data"
mkdir -p "$DATA_DIR"

cat <<EOF > "$CONFIG"
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: glasshouse
    metrics_path: /api/prometheus/metrics
    static_configs:
EOF

for tv in "${TVS[@]}"; do
  # Support ip:port or bare ip (defaulting to 8080)
  target="$tv"
  if [[ "$target" != *:* ]]; then
    target="${target}:8080"
  fi
  cat <<EOF >> "$CONFIG"
      - targets: ["${target}"]
        labels:
          tv: "${tv%%:*}"
EOF
done

echo ""
echo "Starting Prometheus with target(s):"
for tv in "${TVS[@]}"; do
  echo "  • http://${tv%%:*}:8080/api/prometheus/metrics"
done
echo ""
echo "Open Prometheus UI: http://localhost:9090"
echo "Press Ctrl+C to stop."
echo ""

exec "$PROM_BIN" --config.file="$CONFIG" --storage.tsdb.path="$DATA_DIR" --web.console.libraries="${CACHE_DIR}/console_libraries" --web.console.templates="${CACHE_DIR}/consoles"
