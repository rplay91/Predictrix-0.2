#!/bin/bash
SERVICES=("mariadb" "httpd")
TITLE="Database Services Manager"

while true; do
  STATUSES=""
  for srv in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$srv"; then
      STATUSES+="[ON]  $srv\n"
    else
      STATUSES+="[OFF] $srv\n"
    fi
  done

  CHOICE=$(whiptail --title "$TITLE" \
    --menu "Current status:\n$STATUSES\nSelect action:" \
    18 50 6 \
    "1" "Start MariaDB" \
    "2" "Stop  MariaDB" \
    "3" "Restart MariaDB" \
    "4" "Start Apache" \
    "5" "Stop  Apache" \
    "6" "Restart Apache" \
    "7" "Start Both" \
    "8" "Stop  Both" \
    "9" "Exit" \
    3>&1 1>&2 2>&3)

  [ -z "$CHOICE" ] && break

  PASS="12345"
  case "$CHOICE" in
    1) echo "$PASS" | sudo -S systemctl start mariadb ;;
    2) echo "$PASS" | sudo -S systemctl stop mariadb ;;
    3) echo "$PASS" | sudo -S systemctl restart mariadb ;;
    4) echo "$PASS" | sudo -S systemctl start httpd ;;
    5) echo "$PASS" | sudo -S systemctl stop httpd ;;
    6) echo "$PASS" | sudo -S systemctl restart httpd ;;
    7) echo "$PASS" | sudo -S systemctl start mariadb httpd ;;
    8) echo "$PASS" | sudo -S systemctl stop mariadb httpd ;;
    9) break ;;
  esac

  whiptail --title "$TITLE" --msgbox "Done!" 8 30
done
