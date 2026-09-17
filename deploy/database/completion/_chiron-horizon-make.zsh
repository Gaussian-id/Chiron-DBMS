#compdef make
# Source this file after running `autoload -Uz compinit && compinit`.

typeset -g _chiron_horizon_make_repository_root="${${(%):-%x}:A:h:h:h:h}"
if (( ! ${+_chiron_horizon_make_previous_completion} )); then
  typeset -g _chiron_horizon_make_previous_completion="${_comps[make]:-_make}"
fi

_chiron_horizon_make_database_selectors() {
  node "$_chiron_horizon_make_repository_root/scripts/database-env.mjs" selectors 2>/dev/null
}

_chiron_horizon_make_fallback() {
  local completer="${_chiron_horizon_make_previous_completion:-_make}"
  [[ "$completer" == _chiron_horizon_make ]] && completer=_make
  "$completer" "$@"
}

_chiron_horizon_make() {
  local current="${words[CURRENT]}"
  local target="${words[2]}"
  local -a selectors parameters

  if [[ "${PWD:A}" != "$_chiron_horizon_make_repository_root" ]] || (( CURRENT == 2 )); then
    _chiron_horizon_make_fallback "$@"
    return
  fi

  case "$target" in
    db|db-verify|db-down|db-reset)
      if [[ "$current" == DB=* ]]; then
        selectors=("${(@f)$(_chiron_horizon_make_database_selectors)}")
        compset -P 'DB='
        _describe 'database recipe' selectors
      elif [[ "$target" == db-reset && "$current" == CONFIRM=* ]]; then
        compset -P 'CONFIRM='
        compadd '1'
      else
        parameters=(DB DB_BIND_ADDRESS DB_PORT DB_PASSWORD)
        [[ "$target" == db-reset ]] && parameters+=(CONFIRM)
        compadd -S '=' -- $parameters
      fi
      ;;
    *)
      _chiron_horizon_make_fallback "$@"
      ;;
  esac
}

compdef _chiron_horizon_make make
