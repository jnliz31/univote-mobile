#!/bin/sh
set -e

# Cache configuration, routes, and views for production performance
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Ensure the mounted persistent disk is writable by PHP-FPM (www-data)
chown -R www-data:www-data /var/www/html/storage || true

# Create the public/storage symlink so uploaded files (avatars, candidate photos) are served
php artisan storage:link || true

# Automatically run database migrations on Render startup
echo "Running database migrations..."
php artisan migrate --force || true

# Start Supervisor (which starts Nginx and PHP-FPM)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
