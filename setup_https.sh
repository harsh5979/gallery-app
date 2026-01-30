#!/bin/bash

# Setup HTTPS for Gallery App on Ubuntu

DOMAIN="gallery.iomd.site"
APP_PORT="3000"

echo "Using domain: $DOMAIN"

# 1. Install Nginx and Certbot
echo "Installing Nginx and Certbot..."
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Create Nginx Config
echo "Configuring Nginx..."
sudo cat > /etc/nginx/sites-available/gallery <<EOF
server {
    server_name $DOMAIN;

    # Increase body size for upload
    client_max_body_size 30000M;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts for large uploads
        proxy_read_timeout 3600;
        proxy_connect_timeout 3600;
        proxy_send_timeout 3600;
        send_timeout 3600;
    }

    # Cache static files
    location /_next/static {
        proxy_pass http://localhost:$APP_PORT;
        expires 365d;
        access_log off;
    }
}
EOF

# 3. Enable Site
echo "Enabling site..."
sudo ln -sf /etc/nginx/sites-available/gallery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Test and Restart Nginx
echo "Restarting Nginx..."
sudo nginx -t && sudo systemctl restart nginx

# 5. Run Certbot
echo "Running Certbot for SSL..."
# This is interactive, requires email
sudo certbot --nginx -d $DOMAIN

echo "--------------------------------------------------"
echo "Setup Complete!"
echo "Your app should be live at https://$DOMAIN"
echo "--------------------------------------------------"
