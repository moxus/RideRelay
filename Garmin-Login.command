#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
deno task garmin:login
printf '\nZum Schließen Enter drücken.\n'
read -r
