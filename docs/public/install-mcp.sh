#!/bin/sh
set -eu

fail() { printf 'chiron-horizon-mcp: %s\n' "$*" >&2; exit 1; }
fetch() { curl -qfsSL --connect-timeout 10 --max-time 120 --proto '=https' --proto-redir '=https' "$1" -o "$2" 2>/dev/null; }
valid_version() {
  case "$1" in ''|*[!0-9.]*) return 1 ;; esac
  printf '%s\n' "$1" | LC_ALL=C grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'
}
newer_version() {
  awk -v current="$1" -v latest="$2" 'BEGIN {
    split(current, currentParts, "."); split(latest, latestParts, ".")
    for (part = 1; part <= 3; part++) {
      if (currentParts[part] + 0 > latestParts[part] + 0) exit 0
      if (currentParts[part] + 0 < latestParts[part] + 0) exit 1
    }
    exit 1
  }'
}
json_field() {
  LC_ALL=C awk -v wanted="$1" '
    { text = text $0 }
    END {
      while (match(text, /"([^"\\]|\\.)*"|[{}:,]/)) {
        token = substr(text, RSTART, RLENGTH); text = substr(text, RSTART + RLENGTH)
        if (token == "{") { depth++; key[depth] = "" }
        else if (token == "}") { delete key[depth]; depth-- }
        else if (substr(token, 1, 1) == "\"") {
          value = substr(token, 2, length(token) - 2)
          if (previous == "{" || previous == ",") key[depth] = value
          else if (previous == ":" && ((depth == 1 && key[depth] == wanted) ||
                   (depth == 2 && key[1] == "dist" && wanted == "integrity" && key[depth] == wanted))) print value
        }
        previous = token
      }
    }'
}
json_quote() {
  LC_ALL=C awk 'BEGIN { printf "\"" } {
    if (NR > 1) printf "\\n"
    for (position = 1; position <= length($0); position++) {
      character = substr($0, position, 1)
      if (character == "\\" || character == "\"") printf "\\%s", character
      else if (character == "\t") printf "\\t"
      else if (character == "\r") printf "\\r"
      else printf "%s", character
    }
  } END { printf "\"" }'
}
print_configs() {
  quoted_binary=$(printf '%s' "$binary" | json_quote)
  printf '\nClaude Code (.mcp.json), Cursor (.cursor/mcp.json), ZCode config, generic JSON:\n'
  printf '{"mcpServers":{"chiron-horizon":{"command":%s}}}\n' "$quoted_binary"
  printf '\nCodex (~/.codex/config.toml):\n[mcp_servers.chiron-horizon]\ncommand = %s\n' "$quoted_binary"
  if command -v chiron-horizon-mcp-server >/dev/null 2>&1; then
    printf '\nExisting npm launcher: %s\n' "$(command -v chiron-horizon-mcp-server)"
    printf 'Replace its command with %s and remove Node/npx arguments; preserve env.\n' "$quoted_binary"
    printf 'Optional cleanup: npm rm -g @chiron-horizon/mcp-server\n'
  fi
}
configure_path() {
  case ":${PATH:-}:" in *":$install_dir:"*) return ;; esac
  case "${SHELL:-}" in
    */zsh) rc_file="${ZDOTDIR:-$HOME}/.zshrc" ;;
    */bash)
      if [ "$operating_system" = Darwin ]; then rc_file="$HOME/.bash_profile"; else rc_file="$HOME/.bashrc"; fi
      ;;
    *) printf '\nAdd %s to PATH for terminal use. Client configs already use the absolute path.\n' "$install_dir"; return ;;
  esac
  if ! grep -Fq '# added by chiron-horizon installer' "$rc_file" 2>/dev/null; then
    printf '\n# added by chiron-horizon installer\nexport PATH="$HOME/.chiron-horizon/bin:$PATH"\n' >> "$rc_file" ||
      printf 'Could not update %s; add %s to PATH manually.\n' "$rc_file" "$install_dir" >&2
  fi
}

for dependency in curl tar openssl awk sed grep sort; do
  command -v "$dependency" >/dev/null 2>&1 || fail "Required command not found: $dependency"
done
operating_system=$(uname -s)
case "$operating_system" in Darwin) platform=darwin ;; Linux) platform=linux ;; *) fail 'Use install-mcp.ps1 on Windows.' ;; esac
case "$(uname -m)" in arm64|aarch64) architecture=arm64 ;; x86_64|amd64) architecture=x64 ;; *) fail 'Unsupported CPU architecture.' ;; esac
platform="$platform-$architecture"
case "$platform" in linux-*) platform="$platform-gnu" ;; esac
: "${HOME:?HOME must be set}"
mkdir -p "$HOME/.chiron-horizon/bin"
install_dir=$(cd "$HOME/.chiron-horizon/bin" && pwd -P)
binary="$install_dir/chiron-horizon-mcp"
marker="$install_dir/.chiron-horizon-mcp-version"
work_dir=$(mktemp -d "$install_dir/.chiron-horizon-mcp-install.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT
trap 'exit 1' HUP INT TERM
umask 077

version=''
for registry in https://registry.npmjs.org https://registry.npmmirror.com; do
  if fetch "$registry/@chiron-horizon/mcp-server/latest" "$work_dir/latest.json"; then
    candidate=$(json_field version < "$work_dir/latest.json")
    if valid_version "$candidate"; then version=$candidate; break; fi
  fi
done
if [ -z "$version" ] && fetch 'https://api.github.com/repos/Gaussian-id/Chiron-DBMS/git/matching-refs/tags/packages-v' "$work_dir/refs.json"; then
  version=$(json_field ref < "$work_dir/refs.json" | sed -n 's|^refs/tags/packages-v\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$|\1|p' | sort -t . -k1,1n -k2,2n -k3,3n | tail -n 1)
fi
valid_version "$version" || fail 'Unable to resolve a release (offline or registries unavailable); existing installation unchanged.'
current=''
if [ -x "$binary" ]; then
  current=$("$binary" --version </dev/null 2>/dev/null) || current=''
  current=${current#chiron-horizon-mcp }
  if ! valid_version "$current" && [ -f "$marker" ]; then current=$(cat "$marker"); fi
fi
if [ "$current" = "$version" ]; then
  printf 'chiron-horizon-mcp %s already up to date\n' "$version"
  configure_path
  print_configs
  exit 0
fi
if valid_version "$current" && newer_version "$current" "$version"; then
  printf 'chiron-horizon-mcp %s is newer than available %s; keeping current installation\n' "$current" "$version"
  configure_path
  print_configs
  exit 0
fi

downloaded=false
for registry in https://registry.npmjs.org https://registry.npmmirror.com; do
  if ! fetch "$registry/@chiron-horizon/mcp-$platform/$version" "$work_dir/package.json"; then continue; fi
  integrity=$(json_field integrity < "$work_dir/package.json")
  if ! printf '%s\n' "$integrity" | grep -Eq '^sha512-[A-Za-z0-9+/]{86}==$'; then continue; fi
  if ! fetch "$registry/@chiron-horizon/mcp-$platform/-/mcp-$platform-$version.tgz" "$work_dir/archive"; then continue; fi
  actual="sha512-$(openssl dgst -sha512 -binary "$work_dir/archive" | openssl base64 -A)"
  [ "$actual" = "$integrity" ] || fail "Integrity verification failed for $registry; refusing to install."
  tar -xOzf "$work_dir/archive" package/bin/chiron-horizon-mcp > "$work_dir/chiron-horizon-mcp" || fail 'Binary missing from npm archive.'
  downloaded=true
  break
done
if [ "$downloaded" = false ]; then
  asset="chiron-horizon-mcp-$platform.tar.gz"
  release="https://github.com/Gaussian-id/Chiron-DBMS/releases/download/packages-v$version"
  fetch "$release/SHA256SUMS" "$work_dir/SHA256SUMS" && fetch "$release/$asset" "$work_dir/archive" || fail 'All download sources unavailable; existing installation unchanged.'
  expected=$(awk -v asset="$asset" '$2 == asset { print $1 }' "$work_dir/SHA256SUMS")
  actual=$(openssl dgst -sha256 "$work_dir/archive" | sed 's/^.*= //')
  printf '%s\n' "$expected" | grep -Eq '^[a-fA-F0-9]{64}$' && [ "$actual" = "$expected" ] || fail 'SHA256 verification failed; refusing to install.'
  tar -xOzf "$work_dir/archive" chiron-horizon-mcp > "$work_dir/chiron-horizon-mcp" || fail 'Binary missing from Release archive.'
fi
[ -s "$work_dir/chiron-horizon-mcp" ] || fail 'Downloaded binary is empty.'
chmod 755 "$work_dir/chiron-horizon-mcp"
printf '%s\n' "$version" > "$work_dir/version"
mv -f "$work_dir/chiron-horizon-mcp" "$binary"
mv -f "$work_dir/version" "$marker"
configure_path
printf 'Installed chiron-horizon-mcp %s at %s\n' "$version" "$binary"
print_configs
