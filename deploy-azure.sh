#!/bin/bash

# Azure Deployment Script for InterIIT Backend
# This script automates the deployment to Azure App Service

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="interiit-rg"
APP_NAME="interiit-backend"
LOCATION="eastus"
PLAN_NAME="interiit-plan"
SKU="B1"  # Basic tier - change to F1 for free tier

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   InterIIT Backend - Azure Deploy     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    echo -e "${YELLOW}Install it with: brew install azure-cli${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI found${NC}"

# Login to Azure
echo -e "\n${BLUE}📝 Logging into Azure...${NC}"
az account show &> /dev/null || az login

# Get subscription info
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in to: $SUBSCRIPTION_NAME${NC}"

# Create resource group
echo -e "\n${BLUE}📦 Creating resource group: $RESOURCE_GROUP${NC}"
if az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠ Resource group already exists${NC}"
else
    az group create --name $RESOURCE_GROUP --location $LOCATION --output none
    echo -e "${GREEN}✓ Resource group created${NC}"
fi

# Create App Service Plan
echo -e "\n${BLUE}📋 Creating App Service Plan: $PLAN_NAME${NC}"
if az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠ App Service Plan already exists${NC}"
else
    az appservice plan create \
        --name $PLAN_NAME \
        --resource-group $RESOURCE_GROUP \
        --sku $SKU \
        --is-linux \
        --output none
    echo -e "${GREEN}✓ App Service Plan created${NC}"
fi

# Create Web App
echo -e "\n${BLUE}🌐 Creating Web App: $APP_NAME${NC}"
if az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠ Web App already exists${NC}"
else
    az webapp create \
        --resource-group $RESOURCE_GROUP \
        --plan $PLAN_NAME \
        --name $APP_NAME \
        --runtime "NODE:20-lts" \
        --output none
    echo -e "${GREEN}✓ Web App created${NC}"
fi

# Configure environment variables
echo -e "\n${BLUE}⚙️  Configuring environment variables...${NC}"
echo -e "${YELLOW}Please provide the following information:${NC}"

# Read MongoDB URI
if [ -z "$MONGODB_URI" ]; then
    echo -n "MongoDB URI: "
    read -s MONGODB_URI
    echo ""
fi

# Read JWT Secret
if [ -z "$JWT_SECRET" ]; then
    echo -n "JWT Secret (min 32 characters): "
    read -s JWT_SECRET
    echo ""
fi

# Read JWT Expiry (optional)
if [ -z "$JWT_EXPIRES_IN" ]; then
    JWT_EXPIRES_IN="7d"
fi

# Set environment variables
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        NODE_ENV=production \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
        JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
        PORT=8080 \
        SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    --output none

echo -e "${GREEN}✓ Environment variables configured${NC}"

# Configure startup command
echo -e "\n${BLUE}🚀 Configuring startup command...${NC}"
az webapp config set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --startup-file "node server.js" \
    --output none

echo -e "${GREEN}✓ Startup command configured${NC}"

# Enable logging
echo -e "\n${BLUE}📊 Enabling application logs...${NC}"
az webapp log config \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --application-logging filesystem \
    --detailed-error-messages true \
    --failed-request-tracing true \
    --web-server-logging filesystem \
    --output none

echo -e "${GREEN}✓ Logging enabled${NC}"

# Deploy code
echo -e "\n${BLUE}📤 Deploying application code...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"

# Create a zip deployment
zip -r deploy.zip . \
    -x "*.git*" \
    -x "*node_modules*" \
    -x "*.env*" \
    -x "*storage/logs/*" \
    -x "*.DS_Store*" \
    -x "deploy.zip" \
    > /dev/null 2>&1

az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --src deploy.zip \
    --output none

rm deploy.zip

echo -e "${GREEN}✓ Application deployed${NC}"

# Get the URL
APP_URL=$(az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName -o tsv)

echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Deployment Successful! 🎉       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo -e "\n${BLUE}📍 Your app is live at:${NC}"
echo -e "${GREEN}   https://$APP_URL${NC}"
echo -e "\n${BLUE}📝 Useful commands:${NC}"
echo -e "   View logs:    ${YELLOW}az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "   Restart app:  ${YELLOW}az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "   Stop app:     ${YELLOW}az webapp stop --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "   Start app:    ${YELLOW}az webapp start --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "   Delete all:   ${YELLOW}az group delete --name $RESOURCE_GROUP --yes${NC}"
echo -e "\n${BLUE}🔍 Test your deployment:${NC}"
echo -e "   ${YELLOW}curl https://$APP_URL/health${NC}"
echo ""
