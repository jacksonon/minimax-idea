#!/usr/bin/env bash
# Compatibility shim. The real script is scripts/prod.sh.
#
# This file used to be a standalone one-shot setup script. It has
# been folded into scripts/prod.sh (subcommand: setup). This
# shim remains so any operator who still types
# 'bash scripts/setup-prod.sh' gets the same behavior.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/prod.sh" setup
