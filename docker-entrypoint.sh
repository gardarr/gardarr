#!/bin/sh
set -e

# Gardarr Docker Entrypoint
# This script allows running the container in different modes:
# - Service mode (default): no arguments or any argument except "agent"
# - Agent mode: pass "agent" as first argument

# Default to service mode if no arguments provided
if [ $# -eq 0 ]; then
    exec ./main
fi

# If first argument is "agent", run in agent mode
if [ "$1" = "agent" ]; then
    shift  # Remove "agent" from arguments
    exec ./main agent "$@"
fi

# Otherwise, pass all arguments to the binary (service mode with custom args)
exec ./main "$@"

