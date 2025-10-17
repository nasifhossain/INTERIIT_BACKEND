#!/bin/bash

# Azure Container Deployment Script
# Deploys the application using Docker containers to Azure Container Instances

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="interiit-rg"
REGISTRY_NAME="interiitregistry"
IMAGE_NAME="interiit-backend"
CONTAINER_NAME="interiit-backend"
LOCATION="eastus"
DNS_LABEL="interiit-backend-api"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Azure Container Instance Deploy     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

# Login to Azure
echo -e "\n${BLUE}📝 Logging into Azure...${NC}"
az account show &> /dev/null || az login

# Create resource group
echo -e "\n${BLUE}📦 Creating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION --output none
echo -e "${GREEN}✓ Resource group ready${NC}"

# Create Container Registry
echo -e "\n${BLUE}📦 Creating Azure Container Registry...${NC}"
if az acr show --name $REGISTRY_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠ Container Registry already exists${NC}"
else
    az acr create \
        --resource-group $RESOURCE_GROUP \
        --name $REGISTRY_NAME \
        --sku Basic \
        --admin-enabled true \
        --output none
    echo -e "${GREEN}✓ Container Registry created${NC}"
fi

# Get registry credentials
echo -e "\n${BLUE}🔑 Getting registry credentials...${NC}"
REGISTRY_URL=$(az acr show --name $REGISTRY_NAME --query loginServer -o tsv)
REGISTRY_USERNAME=$(az acr credential show --name $REGISTRY_NAME --query username -o tsv)
REGISTRY_PASSWORD=$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv)

# Build and push image
echo -e "\n${BLUE}🏗️  Building Docker image...${NC}"
az acr build \
    --registry $REGISTRY_NAME \
    --image ${IMAGE_NAME}:latest \
    --file Dockerfile \
    . \
    --output none

echo -e "${GREEN}✓ Image built and pushed${NC}"

# Get environment variables
echo -e "\n${BLUE}⚙️  Environment configuration...${NC}"
if [ -z "$MONGODB_URI" ]; then
    echo -n "MongoDB URI: "
    read -s MONGODB_URI
    echo ""
fi

if [ -z "$JWT_SECRET" ]; then
    echo -n "JWT Secret: "
    read -s JWT_SECRET
    echo ""
fi

# Deploy container
echo -e "\n${BLUE}🚀 Deploying container...${NC}"
az container create \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --image ${REGISTRY_URL}/${IMAGE_NAME}:latest \
    --registry-login-server $REGISTRY_URL \
    --registry-username $REGISTRY_USERNAME \
    --registry-password $REGISTRY_PASSWORD \
    --dns-name-label $DNS_LABEL \
    --ports 3000 \
    --cpu 1 \
    --memory 1 \
    --environment-variables \
        NODE_ENV=production \
        JWT_EXPIRES_IN=7d \
    --secure-environment-variables \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
    --output none

echo -e "${GREEN}✓ Container deployed${NC}"

# Get container URL
CONTAINER_URL=$(az container show \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --query ipAddress.fqdn -o tsv)

echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Container Deployment Success! 🎉   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo -e "\n${BLUE}📍 Your API is live at:${NC}"
echo -e "${GREEN}   http://${CONTAINER_URL}:3000${NC}"
echo -e "\n${BLUE}📝 Useful commands:${NC}"
echo -e "   View logs:    ${YELLOW}az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME${NC}"
echo -e "   Container info: ${YELLOW}az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME${NC}"
echo -e "   Delete:       ${YELLOW}az container delete --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --yes${NC}"
echo ""
