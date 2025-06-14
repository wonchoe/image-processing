![CI](https://github.com/wonchoe/image-processing/actions/workflows/main.yml/badge.svg)
![Lambda Deploy](https://img.shields.io/github/actions/workflow/status/wonchoe/image-processing/lambda.yml?label=Lambda%20deploy)

![AWS](https://img.shields.io/badge/AWS-Deployed-orange?logo=amazon-aws)
![SAM](https://img.shields.io/badge/AWS-SAM-informational?logo=awslambda)

# Image Upload and Processing Infrastructure

This project demonstrates **advanced cloud architecture skills** by implementing a **scalable, secure, and distributed image processing pipeline** using AWS services. It leverages ECS, Aurora, Lambda, EventBridge, S3, and other AWS components to enable secure image uploads, resizing, and blog post creation stored in a database. The infrastructure prioritizes security with private subnets, VPC endpoints, SSM Parameter Store, and Secrets Manager, while showcasing proficiency in both serverless (AWS SAM) and traditional (CloudFormation) infrastructure as code.

CI/CD pipelines, built with **GitHub Actions**, automate container builds and Lambda deployments, ensuring a streamlined and repeatable process. While infrastructure provisioning could also be automated, I believe deploying infrastructure separately provides better control and safety for critical resources.

---

## Architecture Diagram

[<img src="diagrams/image.png" width="700" style="cursor:pointer;" alt="Architecture Diagram" />](diagrams/image.png)

---

## Project Overview

This project showcases a robust, production-ready pipeline for processing user-uploaded images and generating blog posts, designed to highlight advanced AWS architecture expertise. Key features include:

- **Secure Image Uploads**: Users generate presigned URLs via API Gateway and Lambda to upload images directly to an S3 bucket.
- **Event-Driven Processing**: S3 upload events trigger EventBridge, which sends data to an SQS queue, invoking a Lambda function to orchestrate ECS tasks.
- **Image Processing**: ECS tasks resize images, generate random blog post fields, and save posts to an Aurora database.
- **Output Storage**: Processed images are stored in a designated S3 output folder.
- **Web Access**: Users can view blog posts and images via an EC2-hosted application.
- **CI/CD Automation**: GitHub Actions workflows automate container builds and Lambda deployments.

The decision to implement a distributed architecture over a simpler solution was made to demonstrate proficiency in designing complex, enterprise-grade cloud systems.

---

## Technologies Used

- **Compute**: ECS (Fargate), Lambda, EC2
- **Storage**: S3, Aurora (RDS)
- **Event Handling**: EventBridge, SQS
- **Security**: VPC, Private Subnets, VPC Endpoints, IAM Roles, SSM Parameter Store, Secrets Manager
- **CI/CD**: GitHub Actions
- **IaC**: AWS SAM, CloudFormation
- **Containerization**: Docker, ECR

---

## Deployment Instructions

The deployment process is partially automated using GitHub Actions for CI/CD, with manual steps for infrastructure to ensure control and safety.

### 1. Build and Push Containers

- **Trigger**: Run the GitHub Actions workflow in `/src/`.
- **Action**: Builds the Docker image and pushes it to AWS ECR for use by ECS tasks.

### 2. Deploy Lambda Functions

- **Trigger**: Run the GitHub Actions workflow in the Lambda source directory.
- **Action**: Packages and uploads Lambda code to an S3 bucket, automatically updating the function during infrastructure deployment.
- **Note**: If the infrastructure is already deployed, the Lambda function updates seamlessly.

### 3. Deploy SAM Stack (API and Lambda)

- **Location**: `infra/sam-stack/sam-app/`
- **Commands**:
  ```bash
  sam build
  sam deploy --guided
  ```
- **Outcome**: Provisions API Gateway and Lambda functions for generating presigned URLs for S3 uploads.

### 4. Deploy CloudFormation Infrastructure

- **Location**: `infra/templates/`
- **Command**:
  ```bash
  aws cloudformation deploy --template-file main.yaml --stack-name img-processing --capabilities CAPABILITY_NAMED_IAM
  ```
- **Outcome**: Provisions VPC, ECS, Aurora, S3, EventBridge, SQS, SSM, Secrets Manager, and other resources.

---

## Security Considerations

The infrastructure is designed with security as a priority:

- **Network**: Private subnets, VPC endpoints, and Security Groups restrict resource access.
- **Secrets Management**: SSM Parameter Store and Secrets Manager securely store and retrieve sensitive data.
- **IAM**: Granular IAM roles and policies limit permissions to the least privilege required.
- **Improvements**: Additional hardening is possible by tightening IAM policies, deploying Lambda functions in private subnets, and integrating monitoring (e.g., CloudWatch, AWS Config).

---

## CI/CD Automation

This project includes **GitHub Actions workflows** to automate key deployment tasks:

- **Container Deployment**: Automatically builds and pushes Docker images to ECR.
- **Lambda Deployment**: Packages and uploads Lambda code to S3 for seamless updates.

While infrastructure deployment could be automated via GitHub Actions, I recommend keeping it as a separate manual step to maintain oversight and prevent unintended changes to critical resources.

---

## Future Enhancements

- Add CloudWatch alarms and dashboards for monitoring pipeline health.
- Integrate AWS WAF for API Gateway to enhance security.
- Optimize costs with Spot Instances for ECS or Graviton-based Lambda functions.

---
🛡️ MIT License — Free to use, share, and modify.  

© 2025 Oleksii — Image Processing Pipeline