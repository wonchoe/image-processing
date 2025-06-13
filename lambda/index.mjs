import {
  SSMClient,
  GetParameterCommand
} from "@aws-sdk/client-ssm";
import {
  ECSClient,
  RunTaskCommand
} from "@aws-sdk/client-ecs";
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";

export const handler = async (event) => {
  
  console.log("📦 Incoming event:", JSON.stringify(event, null, 2));

  const region = process.env.AWS_REGION || 'us-east-1';
  const ssm = new SSMClient({ region });
  const ecs = new ECSClient({ region });
  const secrets = new SecretsManagerClient({ region });

  const paramKeys = [
    '/image-processing/ecs-cluster',
    '/image-processing/task-definition',
    '/image-processing/subnet-ids',
    '/image-processing/main-queue-url'
  ];

  const ssmValues = {};
  for (const key of paramKeys) {
    const response = await ssm.send(new GetParameterCommand({ Name: key }));
    ssmValues[key] = response.Parameter?.Value;
  }

  console.log("📄 Retrieved SSM values:", ssmValues);

  let payload = {};
  let key = "";
  let bucket = "";

  try {
    const message = event.Records?.[0];
    payload = JSON.parse(message.body);
    key = payload.detail?.object?.key || "";
    bucket = payload.detail?.bucket?.name || "";
  } catch (err) {
    console.error("❌ Failed to parse payload:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid SQS payload" })
    };
  }

  console.log("🧾 S3 Key:", key);
  console.log("🪣 Bucket:", bucket);

  // 📥 Get DB credentials from SecretsManager
  let dbEnv = [];
  try {
    console.log(ssmValues['/image-processing/db-secret-arn']);
    const secretResp = await secrets.send(new GetSecretValueCommand({
      SecretId: ssmValues['/image-processing/db-secret-arn']
    }));
    const secret = JSON.parse(secretResp.SecretString || "{}");

    dbEnv = [
      { name: "MYSQL_HOST", value: secret.host },
      { name: "MYSQL_USER", value: secret.username },
      { name: "MYSQL_PASSWORD", value: secret.password },
      { name: "MYSQL_DATABASE", value: secret.dbname || secret.database || "default" }
    ];
  } catch (err) {
    console.error("❌ Failed to retrieve DB secret:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unable to get DB credentials", detail: err.message })
    };
  }

  const env = [
    { name: "S3_BUCKET", value: bucket },
    { name: "INPUT_KEY", value: key },
    { name: "AWS_REGION", value: region },
    { name: "SQS_URL", value: ssmValues['/image-processing/main-queue-url'] },
    ...dbEnv
  ];

  console.log("🧬 Container ENV:", env);

  try {
    const runTask = await ecs.send(new RunTaskCommand({
      cluster: ssmValues['/image-processing/ecs-cluster'],
      taskDefinition: ssmValues['/image-processing/task-definition'],
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ssmValues['/image-processing/subnet-ids'].split(','),
          assignPublicIp: "ENABLED"
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: "worker",
            environment: env
          }
        ]
      }
    }));

    console.log("🚀 Task started:", runTask.tasks?.[0]?.taskArn);

    return {
      statusCode: 200,
      body: JSON.stringify({ task: runTask.tasks?.[0]?.taskArn })
    };

  } catch (err) {
    console.error("❌ Failed to run ECS task:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to start ECS task", detail: err.message })
    };
  }
};
