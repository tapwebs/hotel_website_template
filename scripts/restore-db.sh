#!/usr/bin/env bash
# ==============================================================================
# Database Restore Script with Checksum Integrity Verification
# ==============================================================================
# Usage:
#   bash scripts/restore-db.sh <path-to-backup.sql.gz> --confirm
# ==============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz> [--confirm]"
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM_FLAG="${2:-}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file does not exist: ${BACKUP_FILE}"
  exit 1
fi

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "==> Verifying SHA256 checksum..."
  shasum -a 256 -c "${CHECKSUM_FILE}"
  echo "==> Checksum verified successfully."
else
  echo "WARNING: No checksum file found at ${CHECKSUM_FILE}. Proceeding without verification."
fi

if [ "${CONFIRM_FLAG}" != "--confirm" ]; then
  echo ""
  echo "CAUTION: This will overwrite tables and data in the target database!"
  echo "To execute the restore, re-run with the --confirm flag:"
  echo "  $0 ${BACKUP_FILE} --confirm"
  exit 1
fi

DB_URL="${DATABASE_URL:-}"
if [ -z "${DB_URL}" ] && [ -f "backend/.env" ]; then
  DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

echo "==> Restoring database from ${BACKUP_FILE}..."

if [[ "${DB_URL}" == *"sqlite"* ]]; then
  DB_PATH=$(echo "${DB_URL}" | sed -E 's|^sqlite\+aiosqlite:///||; s|^sqlite:///||')
  echo "==> Restoring SQLite file to ${DB_PATH}..."
  gunzip -c "${BACKUP_FILE}" > "${DB_PATH}"
else
  echo "==> Restoring PostgreSQL database..."
  if [ -n "${DB_URL}" ]; then
    gunzip -c "${BACKUP_FILE}" | psql "${DB_URL}" --single-transaction
  else
    PGHOST="${PGHOST:-127.0.0.1}"
    PGPORT="${PGPORT:-5432}"
    PGUSER="${PGUSER:-postgres}"
    PGDATABASE="${PGDATABASE:-dreamheavens}"
    gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --single-transaction
  fi
fi

echo "==> Restore completed successfully at $(date)."
