# Security

For a suspected security vulnerability, use GitHub's private vulnerability
reporting for this repository. Do not include health records or credentials in
public issues. If private reporting is unavailable, request a private contact
channel without publishing exploit details or sensitive information.

Only the latest development branch currently receives fixes; this is an early
release and is not a validated clinical product. Keep the service private to your
household. HTTPS is required for non-local access. Use a strong administrator
password, a restricted reverse proxy, and protected backups.

Sessions and provider keys are invalidated on restart. Provider keys are held in
server memory only. Public assets may be cached; private records may not. Inventory
and restore operations require authentication, exact origin, and CSRF protection.
