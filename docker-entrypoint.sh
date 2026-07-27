#!/bin/sh
set -e

# NAS platforms (Unraid, Synology, TrueNAS) expect a container to write as a
# specific uid/gid so files land on the array owned by the same user everything
# else uses. Without this the app runs as root and every download is root-owned,
# which the share cannot manage afterwards.
#
# Nothing is applied unless PUID or PGID is set, so a plain `docker run` keeps
# its previous behaviour.
# /app/logs is a symlink to here; the logger creates the directory itself but
# cannot when /app is root-owned and we have dropped privileges.
mkdir -p /app/data/logs

if [ -n "$PUID" ] || [ -n "$PGID" ]; then
    if [ "$(id -u)" != "0" ]; then
        echo "[entrypoint] PUID/PGID set but the container is not running as root; ignoring them." >&2
    else
        PUID="${PUID:-99}"
        PGID="${PGID:-100}"

        if ! getent group "$PGID" >/dev/null 2>&1; then
            groupadd -g "$PGID" qbz
        fi
        if ! getent passwd "$PUID" >/dev/null 2>&1; then
            useradd -u "$PUID" -g "$PGID" -d /app -M -s /usr/sbin/nologin qbz
        fi

        # Only the app's own directory. Recursively chowning a mounted music
        # library would touch every file in it on every single start.
        chown -R "$PUID:$PGID" /app/data 2>/dev/null || true

        if [ -n "$UMASK" ]; then
            umask "$UMASK"
        fi

        echo "[entrypoint] running as ${PUID}:${PGID}"
        exec gosu "${PUID}:${PGID}" "$@"
    fi
fi

if [ -n "$UMASK" ]; then
    umask "$UMASK"
fi

exec "$@"
