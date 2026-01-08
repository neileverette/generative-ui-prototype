# CI/CD Pipeline Documentation

This document describes the GitHub Actions CI/CD pipeline for deploying the Generative UI Prototype to AWS ECS.

## Overview

The pipeline automatically builds and deploys the application when code is pushed to the `main` branch.

```
git push to main → GitHub Actions → Build Docker Image → Push to ECR → Deploy to ECS
```

## AWS Infrastructure

### Resources Created

| Resource | Name | Details |
|----------|------|---------|
| ECR Repository | `generative-ui` | `070322435379.dkr.ecr.us-east-1.amazonaws.com/generative-ui` |
| ECS Cluster | `generative-ui-cluster` | Fargate launch type |
| ECS Service | `generative-ui-service` | Desired count: 1 |
| ALB | `generative-ui-alb` | `generative-ui-alb-584596049.us-east-1.elb.amazonaws.com` |
| IAM Role | `ecsTaskExecutionRole` | ECS task execution permissions |
| IAM User | `github-actions-deploy` | CI/CD deployment permissions |

### IAM Policy for GitHub Actions

The `github-actions-deploy` user has the `GitHubActionsECRECSPolicy` attached with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:070322435379:repository/generative-ui"
    },
    {
      "Sid": "ECSUpdate",
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::070322435379:role/ecsTaskExecutionRole"
    }
  ]
}
```

## GitHub Actions Workflow

### File Location
`.github/workflows/deploy.yml`

### Trigger
- Push to `main` branch
- Manual dispatch (workflow_dispatch)

### Steps
1. **Checkout code** - Clone the repository
2. **Configure AWS credentials** - Authenticate with AWS
3. **Login to ECR** - Get Docker registry credentials
4. **Build and push image** - Build Docker image, tag with commit SHA and `latest`, push to ECR
5. **Update ECS service** - Force new deployment with latest image

## GitHub Secrets Required

Add these in: `Settings → Secrets and variables → Actions`

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `kFim...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `ECR_REPOSITORY` | ECR repository name | `generative-ui` |
| `ECS_CLUSTER` | ECS cluster name | `generative-ui-cluster` |
| `ECS_SERVICE` | ECS service name | `generative-ui-service` |

## Docker Configuration

### Dockerfile
The application uses a multi-stage Docker build:
1. **Build stage** - Node.js 20 Alpine, installs dependencies, builds frontend
2. **Production stage** - Node.js 20 Alpine, runs the server on port 4000

### Exposed Port
- Container port: `4000`

## Deployment Process

### Automatic Deployment
1. Commit changes locally
2. Push to `main` branch
3. GitHub Actions automatically triggers
4. Monitor progress at: `github.com/neileverette/generative-ui-prototype/actions`

### Manual Deployment
1. Go to Actions tab in GitHub
2. Select "Deploy to AWS ECS" workflow
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"

## Monitoring

### GitHub Actions
- View workflow runs: `github.com/neileverette/generative-ui-prototype/actions`

### AWS Console
- ECS Service: `console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/generative-ui-cluster/services`
- ECR Images: `console.aws.amazon.com/ecr/repositories/private/070322435379/generative-ui`
- ALB: `console.aws.amazon.com/ec2/home?region=us-east-1#LoadBalancers`

### Application URL
- **Production**: `http://generative-ui-alb-584596049.us-east-1.elb.amazonaws.com`

## Troubleshooting

### Build Fails
1. Check GitHub Actions logs for error details
2. Verify all secrets are correctly set
3. Ensure Dockerfile builds locally: `docker build -t test .`

### Deployment Fails
1. Check ECS service events in AWS Console
2. Verify task definition has correct image URI
3. Check container logs in CloudWatch

### Image Not Updating
1. Verify ECR has the new image (check tags)
2. Force new deployment: `aws ecs update-service --cluster generative-ui-cluster --service generative-ui-service --force-new-deployment`

## Created
- **Date**: January 7, 2026
- **Setup by**: Claude Code
