#!/bin/sh
set -e

# Gardarr Docker Entrypoint
# This script allows running the container in different modes:
# - Service mode (default): no arguments or any argument except "agent"
# - Agent mode: pass "agent" as first argument

# Use absolute path to ensure binary is found
MAIN_BINARY="/app/main"

DATA_DIR="/data"
MEDIA_DIR="/media"
DB_FILE_PATH="${DATABASE_FILE_PATH:-/data/gardarr_database.db}"
NONROOT_UID="65532"
NONROOT_GID="65532"

get_uid() {
    stat -c %u "$1" 2>/dev/null || echo ""
}

get_gid() {
    stat -c %g "$1" 2>/dev/null || echo ""
}

fix_permissions() {
    if [ "$(id -u)" -ne 0 ]; then
        return 0
    fi

    mkdir -p "$DATA_DIR" "$MEDIA_DIR" 2>/dev/null || true

    db_dir="$(dirname "$DB_FILE_PATH" 2>/dev/null || echo "$DATA_DIR")"
    mkdir -p "$db_dir" 2>/dev/null || true

    if [ -d "$DATA_DIR" ]; then
        chown -R "$NONROOT_UID:$NONROOT_GID" "$DATA_DIR" 2>/dev/null || true
        chmod -R u+rwX,g+rwX "$DATA_DIR" 2>/dev/null || true
    fi

    if [ -d "$MEDIA_DIR" ]; then
        chown -R "$NONROOT_UID:$NONROOT_GID" "$MEDIA_DIR" 2>/dev/null || true
        chmod -R u+rwX,g+rwX "$MEDIA_DIR" 2>/dev/null || true
    fi
}

assert_data_writable() {
    test_file="$DATA_DIR/.write_test"

    if su-exec "$NONROOT_UID:$NONROOT_GID" sh -c "echo test > '$test_file'" 2>/dev/null; then
        rm -f "$test_file" 2>/dev/null || true
        return 0
    fi

    data_uid="$(get_uid "$DATA_DIR")"
    data_gid="$(get_gid "$DATA_DIR")"
    db_uid=""
    db_gid=""
    if [ -e "$DB_FILE_PATH" ]; then
        db_uid="$(get_uid "$DB_FILE_PATH")"
        db_gid="$(get_gid "$DB_FILE_PATH")"
    fi

    echo "ERROR: /data is not writable for UID=$NONROOT_UID (SQLite will fail with readonly database)" >&2
    echo "ERROR: DATA_DIR=$DATA_DIR uid=$data_uid gid=$data_gid" >&2
    echo "ERROR: DB_FILE_PATH=$DB_FILE_PATH uid=$db_uid gid=$db_gid" >&2
    echo "ERROR: If you are using NFS/SMB or a restricted volume driver, it may block chown/chmod." >&2
    echo "ERROR: Workarounds: use a local docker volume, or run the container with user: '0:0'." >&2
    exit 1
}

run_as_nonroot() {
    if [ "$(id -u)" -eq 0 ]; then
        exec su-exec "$NONROOT_UID:$NONROOT_GID" "$@"
    fi
    exec "$@"
}

# Default to service mode if no arguments provided
if [ $# -eq 0 ]; then
    fix_permissions
    assert_data_writable
    run_as_nonroot "$MAIN_BINARY"
fi

# If first argument is "agent", run in agent mode
if [ "$1" = "agent" ]; then
    shift  # Remove "agent" from arguments
    fix_permissions
    assert_data_writable
    run_as_nonroot "$MAIN_BINARY" agent "$@"
fi

# Otherwise, pass all arguments to the binary (service mode with custom args)
fix_permissions
assert_data_writable
run_as_nonroot "$MAIN_BINARY" "$@"

