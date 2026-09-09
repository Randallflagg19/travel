#!/usr/bin/env bash
# Collect evidence before restarting Nginx during an external HTTPS incident.
# Run as tapiradmin on the VPS. The script never changes services or config.

set -u

incident_dir="/home/tapiradmin/travel-frontend/incidents"
incident_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
incident_file="${incident_dir}/https-incident-${incident_stamp}.log"

mkdir -p "$incident_dir"
sudo -v

run_section() {
  local section_title="$1"
  shift

  {
    printf '\n===== %s =====\n' "$section_title"
    "$@"
  } >>"$incident_file" 2>&1 || true
}

{
  printf 'HTTPS incident diagnostic snapshot\n'
  printf 'Captured at (UTC): '
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  printf 'Captured at (server local time): '
  date '+%Y-%m-%d %H:%M:%S %Z'
} >"$incident_file"

run_section 'uptime' uptime
run_section 'memory' free -h
run_section 'disk root' df -h /
run_section 'service status' systemctl status nginx travel-frontend --no-pager
run_section 'listening sockets' sudo ss -ltnp '( sport = :443 or sport = :80 or sport = :3020 )'
run_section 'socket summary' sudo ss -s
run_section 'local frontend health' curl -fsS -I --max-time 10 http://127.0.0.1:3020/
run_section 'local HTTPS with production host' curl -skI --max-time 10 --resolve www.tapir.su:443:127.0.0.1 https://www.tapir.su/
run_section 'nginx configuration test' sudo nginx -t
run_section 'nginx journal, previous 30 minutes' sudo journalctl -u nginx --since '30 minutes ago' --no-pager
run_section 'frontend journal, previous 30 minutes' sudo journalctl -u travel-frontend --since '30 minutes ago' --no-pager
run_section 'nginx error log tail' sudo tail -n 200 /var/log/nginx/error.log
run_section 'production nginx error log tail' sudo tail -n 200 /var/log/nginx/travel-frontend-production.error.log
run_section 'recent kernel messages' sudo journalctl -k --since '30 minutes ago' --no-pager

printf 'Saved diagnostic snapshot: %s\n' "$incident_file"
