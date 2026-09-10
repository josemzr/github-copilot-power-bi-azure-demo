targetScope = 'resourceGroup'

@description('Azure region for all regional resources.')
param location string = resourceGroup().location

@description('Short environment name used in resource names and tags.')
param environmentName string = 'demo'

@description('Data source mode. Keep sample for demonstrations; use github-app only after configuring all GitHub App settings.')
@allowed([
  'sample'
  'github-app'
  'enterprise-report'
])
param dataSourceMode string = 'sample'

@description('Legacy fallback-server exposure flag. Keep false for real Enterprise data.')
param publicMetricsEnabled bool = dataSourceMode == 'sample'

@description('GitHub App ID used to sign server-to-server JWTs.')
param githubAppId string = ''

@description('GitHub App Enterprise installation ID.')
param githubInstallationId string = ''

@description('GitHub Copilot metrics or report-index API URL.')
param githubMetricsUrl string = ''

@description('Optional full Key Vault secret URI for the GitHub App private key. Leave empty in sample mode.')
@secure()
param githubPrivateKeySecretUri string = ''

var applicationName = 'github-copilot-enterprise-metrics'
var uniqueSuffix = toLower(uniqueString(subscription().subscriptionId, resourceGroup().id))
var storageAccountName = 'copilotm${uniqueSuffix}'
var functionAppName = take('func-copilot-metrics-${uniqueSuffix}', 60)
var hostingPlanName = 'plan-copilot-metrics-${environmentName}-${uniqueSuffix}'
var logAnalyticsName = 'log-copilot-metrics-${environmentName}-${uniqueSuffix}'
var applicationInsightsName = 'appi-copilot-metrics-${environmentName}-${uniqueSuffix}'
var keyVaultName = take('kv-copilot-metrics-${uniqueSuffix}', 24)
var metricsContainerName = 'copilot-metrics'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var functionRoleAssignmentVersion = 'v3'
var tags = {
  application: applicationName
  environment: environmentName
  'managed-by': 'bicep'
  purpose: 'enterprise-metrics'
}
var baseAppSettings = [
  {
    name: 'FUNCTIONS_EXTENSION_VERSION'
    value: '~4'
  }
  {
    name: 'FUNCTIONS_WORKER_RUNTIME'
    value: 'node'
  }
  {
    name: 'WEBSITE_NODE_DEFAULT_VERSION'
    value: '~22'
  }
  {
    name: 'AzureWebJobsStorage'
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsights.properties.ConnectionString
  }
  {
    name: 'DATA_SOURCE_MODE'
    value: dataSourceMode
  }
  {
    name: 'PUBLIC_METRICS_ENABLED'
    value: toLower(string(publicMetricsEnabled))
  }
  {
    name: 'METRICS_STORAGE_URL'
    value: storageAccount.properties.primaryEndpoints.blob
  }
  {
    name: 'METRICS_CONTAINER_NAME'
    value: metricsContainerName
  }
  {
    name: 'APP_VERSION'
    value: '1.0.0'
  }
]
var githubSecretAppSetting = empty(githubPrivateKeySecretUri)
  ? []
  : [
      {
        name: 'GITHUB_APP_PRIVATE_KEY'
        value: '@Microsoft.KeyVault(SecretUri=${githubPrivateKeySecretUri})'
      }
    ]
var githubAppSettings = dataSourceMode == 'sample'
  ? []
  : [
      {
        name: 'GITHUB_APP_ID'
        value: githubAppId
      }
      {
        name: 'GITHUB_INSTALLATION_ID'
        value: githubInstallationId
      }
      {
        name: 'GITHUB_METRICS_URL'
        value: githubMetricsUrl
      }
    ]

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource metricsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: metricsContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: hostingPlanName
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: false
      ftpsState: 'Disabled'
      http20Enabled: true
      linuxFxVersion: 'Node|22'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: concat(baseAppSettings, githubAppSettings, githubSecretAppSetting)
      cors: {
        allowedOrigins: []
        supportCredentials: false
      }
    }
  }
}

resource storageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, storageBlobDataContributorRoleId, functionRoleAssignmentVersion)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultSecretsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, keyVaultSecretsUserRoleId, functionRoleAssignmentVersion)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output functionAppName string = functionApp.name
output functionBaseUrl string = 'https://${functionApp.properties.defaultHostName}'
output healthUrl string = 'https://${functionApp.properties.defaultHostName}/api/health'
output metricsUrl string = 'https://${functionApp.properties.defaultHostName}/api/metrics'
output storageAccountName string = storageAccount.name
output metricsContainerName string = metricsContainer.name
output keyVaultName string = keyVault.name
output applicationInsightsName string = applicationInsights.name
output logAnalyticsWorkspaceName string = logAnalytics.name
