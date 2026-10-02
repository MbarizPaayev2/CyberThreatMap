# Jenkins CI/CD Setup for Live Threat Map

This directory contains the Jenkins configuration for the Live Threat Map project.

## Prerequisites

### Jenkins Plugins Required

Install the following plugins in Jenkins:
- **Pipeline** (workflow-aggregator)
- **Git** (git)
- **Node.js** (nodejs)
- **Credentials Binding** (credentials-binding)
- **Timestamper** (timestamper) - optional, for build timestamps

### Jenkins System Configuration

1. **Configure Node.js**:
   - Go to `Manage Jenkins` → `Global Tool Configuration`
   - Scroll to `NodeJS` section
   - Click `Add NodeJS`
   - Name: `NodeJS`
   - Version: Select or install Node.js 18.x or higher
   - Save

2. **Configure Git**:
   - Go to `Manage Jenkins` → `Global Tool Configuration`
   - Scroll to `Git` section
   - Ensure Git is installed and configured
   - Save

## Setup Instructions

### Option 1: Using Jenkins UI (Manual Setup)

1. **Create a new folder**:
   - Go to Jenkins dashboard
   - Click `New Item`
   - Enter name: `live-threat-map`
   - Select `Folder`
   - Click `OK`

2. **Create the pipeline job**:
   - Inside the `live-threat-map` folder, click `New Item`
   - Enter name: `ci-cd-pipeline`
   - Select `Pipeline`
   - Click `OK`

3. **Configure the pipeline**:
   - In the Pipeline section:
     - Definition: `Pipeline script from SCM`
     - SCM: `Git`
     - Repository URL: Your Git repository URL
     - Credentials: Select or add your Git credentials
     - Script Path: `jenkins/Jenkinsfile`
   - Save

4. **Add environment variables** (optional):
   - Go to `Configure` → `This project is parameterized`
   - Add string parameters as needed
   - Save

### Option 2: Using Jenkins Configuration as Code (JCasC)

If you're using JCasC, add the following to your `jenkins.yaml`:

```yaml
jobs:
  - script: |
      folder('live-threat-map') {
          description('Live Threat Map CI/CD')
          properties {
              folderCredentialsProperty {
                  domainCredentials {
                      credentials {
                          usernamePassword {
                              id('git-credentials')
                              username('your-git-username')
                              password('your-git-token')
                          }
                      }
                  }
              }
          }
      }
      pipelineJob('live-threat-map/ci-cd-pipeline') {
          description('CI/CD pipeline for Live Threat Map')
          definition {
              cpsScm {
                  scm {
                      git {
                          remote {
                              url('${GIT_REPOSITORY_URL}')
                              credentials('git-credentials')
                          }
                          branch('*/main')
                      }
                  }
                  scriptPath('jenkins/Jenkinsfile')
              }
          }
      }
```

## Environment Variables

The pipeline requires the following environment variables to be configured in Jenkins:

### Required for Build
- None (standard Node.js build)

### Required for Deployment (if enabled)
- `VERCEL_TOKEN` - Vercel authentication token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### Required for Application Runtime
These should be configured in your deployment environment (not Jenkins):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (keep secret!)
- `CRON_SECRET` - Random secret for cron job authentication
- `ABUSEIPDB_API_KEY` - AbuseIPDB API key (optional, for real threat data)

## Pipeline Stages

The Jenkins pipeline includes the following stages:

1. **Checkout** - Clones the repository and cleans workspace
2. **Setup Node.js** - Configures Node.js environment
3. **Install Dependencies** - Runs `npm ci` to install dependencies
4. **Lint** - Runs linting (configure ESLint to enable)
5. **Build** - Runs `npm run build` to create production bundle
6. **Archive Artifacts** - Archives the `dist/` directory
7. **Deploy** - Deploys to production (only on main/master branches)

## Customization

### Adding Linting

To enable linting, first add ESLint to your project:

```bash
npm install --save-dev eslint
npx eslint --init
```

Then update the `Lint` stage in `jenkins/Jenkinsfile`:

```groovy
stage('Lint') {
    steps {
        script {
            if (isUnix()) {
                sh 'npm run lint'
            } else {
                bat 'npm run lint'
            }
        }
    }
}
```

### Adding Tests

To add testing, install a test framework (e.g., Vitest, Jest):

```bash
npm install --save-dev vitest
```

Add a test script to `package.json`:

```json
"scripts": {
    "test": "vitest"
}
```

Then add a test stage to `jenkins/Jenkinsfile`:

```groovy
stage('Test') {
    steps {
        script {
            if (isUnix()) {
                sh 'npm run test'
            } else {
                bat 'npm run test'
            }
        }
    }
}
```

### Configuring Deployment

The deployment stage is currently a placeholder. To enable deployment:

#### Vercel Deployment

Update the `Deploy` stage in `jenkins/Jenkinsfile`:

```groovy
stage('Deploy') {
    when {
        anyOf {
            branch 'main'
            branch 'master'
        }
    }
    steps {
        script {
            withCredentials([string(credentialsId: 'vercel-token', variable: 'VERCEL_TOKEN')]) {
                if (isUnix()) {
                    sh '''
                        npm install -g vercel
                        vercel --prod --token=$VERCEL_TOKEN
                    '''
                } else {
                    bat '''
                        npm install -g vercel
                        vercel --prod --token=%VERCEL_TOKEN%
                    '''
                }
            }
        }
    }
}
```

Add the `vercel-token` credential in Jenkins:
- Go to `Manage Jenkins` → `Credentials` → `System` → `Global credentials`
- Click `Add Credentials`
- Kind: `Secret text`
- Secret: Your Vercel token
- ID: `vercel-token`
- Create

#### AWS S3 Deployment

For AWS S3 deployment, install the AWS CLI and configure:

```groovy
stage('Deploy') {
    when {
        anyOf {
            branch 'main'
            branch 'master'
        }
    }
    steps {
        script {
            withCredentials([[
                $class: 'AmazonWebServicesCredentialsBinding',
                credentialsId: 'aws-credentials'
            ]]) {
                if (isUnix()) {
                    sh '''
                        aws s3 sync dist/ s3://your-bucket-name --delete
                    '''
                } else {
                    bat '''
                        aws s3 sync dist\\ s3://your-bucket-name --delete
                    '''
                }
            }
        }
    }
}
```

## Triggering Builds

### Manual Trigger
- Go to the pipeline job in Jenkins
- Click `Build with Parameters`
- Select the environment (if configured)
- Click `Build`

### Automatic Trigger (Webhook)
1. In your Git repository (GitHub/GitLab/Bitbucket):
   - Go to Settings → Webhooks
   - Add a new webhook
   - Payload URL: `http://your-jenkins-url/github-webhook/`
   - Content type: `application/json`
   - Events: Push events
   - Add webhook

2. In Jenkins pipeline configuration:
   - Check `Build Triggers` → `GitHub hook trigger for GITScm polling`

### Polling (Alternative)
Configure polling in Jenkins:
- Go to pipeline configuration
- Check `Build Triggers` → `Poll SCM`
- Schedule: `H/5 * * * *` (poll every 5 minutes)

## Troubleshooting

### Node.js Not Found
- Ensure Node.js plugin is installed
- Check Global Tool Configuration for Node.js
- Verify the tool name matches `NodeJS` in Jenkinsfile

### Git Authentication Issues
- Verify Git credentials are correctly configured
- Check the credentials ID matches in pipeline configuration
- Ensure the credentials have proper repository access

### Build Failures
- Check the console output for specific errors
- Verify `npm ci` runs successfully locally
- Ensure all dependencies are in `package-lock.json`

### Deployment Failures
- Verify deployment credentials are correctly configured
- Check that the deployment target is accessible
- Ensure environment variables are set correctly

## Security Best Practices

1. **Use Credentials Binding** - Never hardcode secrets in Jenkinsfile
2. **Restrict Permissions** - Use folder-level permissions for the project
3. **Secret Management** - Use Jenkins Credentials store for sensitive data
4. **RBAC** - Configure role-based access control if using Jenkins RBAC plugin
5. **Workspace Cleanup** - The pipeline automatically cleans workspaces to prevent data leakage

## Additional Resources

- [Jenkins Pipeline Documentation](https://www.jenkins.io/doc/book/pipeline/)
- [Jenkins Node.js Plugin](https://plugins.jenkins.io/nodejs/)
- [Jenkins Credentials Plugin](https://plugins.jenkins.io/credentials/)
