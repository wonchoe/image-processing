## Project Structure and Deployment

### infra/sam-stack/

Contains the SAM stack for deploying serverless components such as Lambda functions and API Gateway.

To deploy this stack, use the AWS SAM CLI:

```bash
sam build
sam deploy --guided
```

### infra/templates/

Contains traditional CloudFormation templates for the core infrastructure: VPC, ECS, RDS, S3, and related resources.
This stack can be deployed and managed directly via the AWS Management Console or AWS CLI.