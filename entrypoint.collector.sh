#!/bin/sh
set -e

PUID=${PUID:-10001}
PGID=${PGID:-10001}

# Update lawncare user/group to match host PUID/PGID
if [ "$(id -u lawncare)" != "$PUID" ] || [ "$(id -g lawncare)" != "$PGID" ]; then
  groupmod -o -g "$PGID" lawncare
  usermod -o -u "$PUID" lawncare
fi

# Fix ownership of the data directory
chown -R lawncare:lawncare /app/data

exec gosu lawncare python collector.py
