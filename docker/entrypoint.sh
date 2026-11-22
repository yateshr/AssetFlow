#!/bin/sh
# Writes /config.js from the container's environment so one image can serve any company's database.
set -eu

if [ -z "${PUBLIC_SUPABASE_URL:-}" ] || [ -z "${PUBLIC_SUPABASE_KEY:-}" ]; then
  echo "AssetFlow: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY are not set. The app will show a 'not configured' screen." >&2
fi

# Escape backslashes and double quotes so the values are safe inside a JavaScript string.
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

cat > /usr/share/nginx/html/config.js <<EOF
window.__ASSETFLOW_CONFIG__ = {
  supabaseUrl: "$(esc "${PUBLIC_SUPABASE_URL:-}")",
  supabaseKey: "$(esc "${PUBLIC_SUPABASE_KEY:-}")"
};
EOF
