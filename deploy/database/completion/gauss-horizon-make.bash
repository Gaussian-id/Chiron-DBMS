# Source this file to complete Gauss Horizon database Make targets and DB=<product>@<version> values.

_gauss_horizon_make_repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [[ -z ${_gauss_horizon_make_previous_completion+x} ]]; then
  _gauss_horizon_make_previous_completion=''
  _gauss_horizon_make_completion_spec="$(complete -p make 2>/dev/null || true)"
  if [[ "$_gauss_horizon_make_completion_spec" =~ -F[[:space:]]+([^[:space:]]+) ]]; then
    _gauss_horizon_make_previous_completion="${BASH_REMATCH[1]}"
  fi
  unset _gauss_horizon_make_completion_spec
fi

_gauss_horizon_make_database_selectors() {
  node "$_gauss_horizon_make_repository_root/scripts/database-env.mjs" selectors 2>/dev/null
}

_gauss_horizon_make_targets() {
  node "$_gauss_horizon_make_repository_root/scripts/database-env.mjs" make-targets 2>/dev/null
}

_gauss_horizon_make_fallback() {
  local current="${COMP_WORDS[COMP_CWORD]}"
  if [[ -n "$_gauss_horizon_make_previous_completion" ]] && declare -F "$_gauss_horizon_make_previous_completion" >/dev/null; then
    "$_gauss_horizon_make_previous_completion"
    return
  fi

  COMPREPLY=()
  [[ "$1" == targets ]] || return

  local targets
  targets="$(_gauss_horizon_make_targets)"
  COMPREPLY=( $(compgen -W "$targets" -- "$current") )
}

_gauss_horizon_make() {
  local current="${COMP_WORDS[COMP_CWORD]}"
  local target="${COMP_WORDS[1]}"
  local selectors

  if [[ "$(pwd -P)" != "$_gauss_horizon_make_repository_root" ]]; then
    _gauss_horizon_make_fallback
    return
  fi
  if (( COMP_CWORD == 1 )); then
    _gauss_horizon_make_fallback targets
    return
  fi

  case "$target" in
    db|db-verify|db-down|db-reset)
      compopt +o bashdefault +o default 2>/dev/null || true
      case "$current" in
        DB=*)
          selectors="$(_gauss_horizon_make_database_selectors)"
          COMPREPLY=( $(compgen -W "$(printf 'DB=%s ' $selectors)" -- "$current") )
          ;;
        CONFIRM=*)
          COMPREPLY=( $(compgen -W 'CONFIRM=1' -- "$current") )
          ;;
        *)
          if [[ "$target" == 'db-reset' ]]; then
            COMPREPLY=( $(compgen -W 'DB= DB_BIND_ADDRESS= DB_PORT= DB_PASSWORD= CONFIRM=1' -- "$current") )
          else
            COMPREPLY=( $(compgen -W 'DB= DB_BIND_ADDRESS= DB_PORT= DB_PASSWORD=' -- "$current") )
          fi
          ;;
      esac
      ;;
    *)
      _gauss_horizon_make_fallback
      ;;
  esac
}

complete -o bashdefault -o default -F _gauss_horizon_make make
