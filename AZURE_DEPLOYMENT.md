# Azure Deployment Configuration for InterIIT Backend

This directory contains Azure-specific configuration files for deploying the application.

## Files

- `deploy-azure.sh` - Automated deployment script
- `.github/workflows/azure-deploy.yml` - GitHub Actions CI/CD pipeline
- `azure-config.json` - Azure App Service configuration

## Quick Start

### Option 1: Manual Deployment (Recommended for first deployment)

1. **Install Azure CLI**
   ```bash
   brew install azure-cli
   ```

2. **Make the script executable**
   ```bash
   chmod +x deploy-azure.sh
   ```

3. **Run the deployment**
   ```bash
   ./deploy-azure.sh
   ```

   The script will prompt you for:
   - MongoDB URI
   - JWT Secret

### Option 2: Using Azure CLI Directly

```bash
# Login
az login

# Create resources
az group create --name interiit-rg --location eastus

az appservice plan create \
  --name interiit-plan \
  --resource-group interiit-rg \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group interiit-rg \
  --plan interiit-plan \
  --name interiit-backend \
  --runtime "NODE:20-lts"

# Set environment variables
az webapp config appsettings set \
  --resource-group interiit-rg \
  --name interiit-backend \
  --settings \
    NODE_ENV=production \
    MONGODB_URI="your-mongodb-uri" \
    JWT_SECRET="your-jwt-secret" \
    JWT_EXPIRES_IN="7d"

# Deploy
zip -r deploy.zip . -x "*.git*" -x "*node_modules*" -x "*.env*"
az webapp deployment source config-zip \
  --resource-group interiit-rg \
  --name interiit-backend \
  --src deploy.zip
```

### Option 3: GitHub Actions (CI/CD)

1. **Create Azure Service Principal**
   ```bash
   az ad sp create-for-rbac \
     --name "interiit-backend-sp" \
     --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/interiit-rg \
     --sdk-auth
   ```

2. **Add GitHub Secret**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add new secret: `AZURE_CREDENTIALS`
   - Paste the JSON output from step 1

3. **Add Environment Variables**
   In Azure Portal or via CLI:
   ```bash
   az webapp config appsettings set \
     --resource-group interiit-rg \
     --name interiit-backend \
     --settings \
       NODE_ENV=production \
       MONGODB_URI="your-mongodb-uri" \
       JWT_SECRET="your-jwt-secret"
   ```

4. **Push to main branch**
   The workflow will automatically deploy your app

## Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-super-secure-secret-key-here` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `PORT` | Application port (auto-set by Azure) | `8080` |

## Configuration

### App Service Plan Tiers

- **F1 (Free)**: Good for testing
  - 1 GB RAM
  - 60 min/day
  - No custom domains
  - Change SKU to `F1` in script

- **B1 (Basic)**: Recommended for production
  - 1.75 GB RAM
  - Always on
  - Custom domains
  - ~$13/month

- **S1 (Standard)**: For scaling
  - 1.75 GB RAM
  - Auto-scaling
  - Staging slots
  - ~$70/month

### Scaling

```bash
# Scale up (vertical)
az appservice plan update \
  --name interiit-plan \
  --resource-group interiit-rg \
  --sku S1

# Scale out (horizontal)
az appservice plan update \
  --name interiit-plan \
  --resource-group interiit-rg \
  --number-of-workers 3
```

## Monitoring

### View Logs

```bash
# Stream logs in real-time
az webapp log tail \
  --name interiit-backend \
  --resource-group interiit-rg

# Download logs
az webapp log download \
  --name interiit-backend \
  --resource-group interiit-rg \
  --log-file logs.zip
```

### Metrics

```bash
# CPU usage
az monitor metrics list \
  --resource /subscriptions/{subscription-id}/resourceGroups/interiit-rg/providers/Microsoft.Web/sites/interiit-backend \
  --metric "CpuPercentage"

# Memory usage
az monitor metrics list \
  --resource /subscriptions/{subscription-id}/resourceGroups/interiit-rg/providers/Microsoft.Web/sites/interiit-backend \
  --metric "MemoryPercentage"
```

## Management Commands

```bash
# Restart app
az webapp restart \
  --name interiit-backend \
  --resource-group interiit-rg

# Stop app
az webapp stop \
  --name interiit-backend \
  --resource-group interiit-rg

# Start app
az webapp start \
  --name interiit-backend \
  --resource-group interiit-rg

# Get app URL
az webapp show \
  --name interiit-backend \
  --resource-group interiit-rg \
  --query defaultHostName -o tsv
```

## Troubleshooting

### App not starting?

1. Check logs:
   ```bash
   az webapp log tail --name interiit-backend --resource-group interiit-rg
   ```

2. Verify environment variables:
   ```bash
   az webapp config appsettings list \
     --name interiit-backend \
     --resource-group interiit-rg
   ```

3. Check startup command:
   ```bash
   az webapp config show \
     --name interiit-backend \
     --resource-group interiit-rg \
     --query linuxFxVersion
   ```

### Database connection issues?

1. Ensure MongoDB URI is correct
2. Check if IP is whitelisted in MongoDB Atlas
3. Azure App Service IP can change - use connection string with `retryWrites=true`

### 500 errors?

1. Check application logs
2. Verify all environment variables are set
3. Ensure `server.js` uses `process.env.PORT` (already configured ✅)

## Custom Domain

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name interiit-backend \
  --resource-group interiit-rg \
  --hostname yourdomain.com

# Enable HTTPS
az webapp config ssl bind \
  --name interiit-backend \
  --resource-group interiit-rg \
  --certificate-thumbprint {thumbprint} \
  --ssl-type SNI
```

## Cost Optimization

1. Use Free tier (F1) for development
2. Enable auto-scaling only when needed
3. Use Azure Calculator: https://azure.microsoft.com/pricing/calculator/
4. Monitor costs: https://portal.azure.com/#blade/Microsoft_Azure_Billing/

## Cleanup

To delete all resources:

```bash
az group delete --name interiit-rg --yes --no-wait
```

## Security Best Practices

1. ✅ Use environment variables for secrets (never commit)
2. ✅ Enable HTTPS only
3. ✅ Restrict CORS origins in production
4. ✅ Use managed identities where possible
5. ✅ Enable Application Insights for monitoring
6. ✅ Regular security updates

## Support

- Azure Docs: https://docs.microsoft.com/azure/app-service/
- Azure Support: https://azure.microsoft.com/support/
- Pricing: https://azure.microsoft.com/pricing/details/app-service/

## Next Steps

1. ✅ Deploy using `./deploy-azure.sh`
2. ✅ Setup MongoDB Atlas or Cosmos DB
3. ✅ Configure custom domain
4. ✅ Enable Application Insights
5. ✅ Setup GitHub Actions for CI/CD
6. ✅ Configure auto-scaling
7. ✅ Add monitoring alerts
