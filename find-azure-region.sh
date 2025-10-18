#!/bin/bash

# Script to find available Azure regions for your subscription
# This helps with Azure for Students subscriptions that have region restrictions

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Finding Available Azure Regions     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

# Common regions to test (most likely to work with Azure for Students)
REGIONS=(
    "centralus"
    "westus2"
    "westeurope"
    "southcentralus"
    "northeurope"
    "eastus2"
    "westus"
    "uksouth"
)

RESOURCE_GROUP="test-region-rg-$RANDOM"

echo -e "\n${YELLOW}Testing regions with your subscription...${NC}"
echo -e "${YELLOW}This may take 1-2 minutes...${NC}\n"

WORKING_REGIONS=()

for region in "${REGIONS[@]}"; do
    echo -n "Testing $region... "
    
    # Try to create a resource group in this region
    if az group create --name $RESOURCE_GROUP --location $region --output none 2>/dev/null; then
        echo -e "${GREEN}✓ Available${NC}"
        WORKING_REGIONS+=("$region")
        # Clean up
        az group delete --name $RESOURCE_GROUP --yes --no-wait 2>/dev/null
        break  # Found one, that's enough
    else
        echo -e "${RED}✗ Restricted${NC}"
    fi
done

echo -e "\n${BLUE}════════════════════════════════════════${NC}"

if [ ${#WORKING_REGIONS[@]} -eq 0 ]; then
    echo -e "${RED}❌ No available regions found in common list${NC}"
    echo -e "${YELLOW}Please contact Azure support or try:${NC}"
    echo -e "   - Check Azure Portal → Subscriptions → Your subscription → Locations"
    echo -e "   - Contact Azure for Students support"
else
    echo -e "${GREEN}✓ Found available region: ${WORKING_REGIONS[0]}${NC}"
    echo -e "\n${BLUE}Update deploy-azure.sh with:${NC}"
    echo -e "${YELLOW}   LOCATION=\"${WORKING_REGIONS[0]}\"${NC}"
    echo -e "\n${BLUE}Or run deployment with:${NC}"
    echo -e "${YELLOW}   LOCATION=\"${WORKING_REGIONS[0]}\" ./deploy-azure.sh${NC}"
fi

echo -e "${BLUE}════════════════════════════════════════${NC}\n"
