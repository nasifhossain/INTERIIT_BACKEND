#!/bin/bash

# Quick deploy script - deploys code to existing Azure App Service
# Use this after initial setup with deploy-azure.sh

set -e

RESOURCE_GROUP="interiit-rg"
APP_NAME="interiit-backend"

echo "🚀 Quick deploying to Azure..."

# Create deployment package
echo "📦 Creating deployment package..."
zip -r deploy.zip . \
    -x "*.git*" \
    -x "*node_modules*" \
    -x "*.env*" \
    -x "*storage/logs/*" \
    -x "*.DS_Store*" \
    -x "deploy.zip" \
    > /dev/null 2>&1

# Deploy
echo "📤 Uploading to Azure..."
az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --src deploy.zip \
    --output none

# Cleanup
rm deploy.zip

# Restart app
echo "🔄 Restarting application..."
az webapp restart \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --output none

APP_URL=$(az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName -o tsv)

echo "✅ Deployment complete!"
echo "🌍 App URL: https://$APP_URL"
